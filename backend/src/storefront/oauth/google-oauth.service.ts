import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { StorefrontService } from '../storefront.service'
import { StorefrontSecurityService } from '../security/storefront-security.service'
import { GoogleConfigService } from '../../common/integrations/google-config.service'
import { EmailService } from '../../email/email.service'
import type { StorefrontAuthSession } from '../types'
import type { FastifyRequest } from 'fastify'
import { randomBytes, randomUUID, createHash } from 'crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Customer } from '@prisma/client'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const OAUTH_PROVIDER = 'google'
const DEFAULT_SCOPE = 'openid email profile'
const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes to complete OAuth exchange

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')

const SHA256 = (value: string) => createHash('sha256').update(value).digest()

type GoogleTokenSuccess = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  id_token: string
}

type GoogleTokenError = {
  error: string
  error_description?: string
}

export type GoogleOAuthPurpose = 'login' | 'recover' | 'reauth'

export type GoogleOAuthStartResult = {
  url: string
  state: string
  expiresAt: string
  purpose: GoogleOAuthPurpose
}

export type GoogleOAuthResult =
  | {
      status: 'success'
      session: StorefrontAuthSession | null
      returnPath: string | null
      state?: string | null
      purpose: GoogleOAuthPurpose
      profile: {
        email: string
        name?: string | null
        picture?: string | null
      }
      reauthToken?: { token: string; expiresAt: string }
      nextAction?: 'none' | 'set_password' | 'reset_password'
    }
  | {
      status: 'error'
      errorCode: string
      message: string
      details?: string | null
      returnPath: string | null
      state?: string | null
      purpose?: GoogleOAuthPurpose
    }

@Injectable()
export class StorefrontGoogleOAuthService {
  private readonly logger = new Logger(StorefrontGoogleOAuthService.name)
  private readonly defaultScopes = DEFAULT_SCOPE

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storefront: StorefrontService,
    private readonly googleConfig: GoogleConfigService,
    private readonly security: StorefrontSecurityService,
    private readonly email: EmailService,
  ) {}

  async start(
    returnPath: string | undefined,
    req: FastifyRequest,
    purpose: GoogleOAuthPurpose = 'login',
    expectedCustomerId?: number | null,
  ): Promise<GoogleOAuthStartResult> {
    const { clientId, clientSecret, redirectUri } = await this.requireCredentials(true)

    await this.prisma.storefrontOAuthSession.deleteMany({
      where: {
        expiresAt: { lt: new Date(Date.now() - SESSION_TTL_MS) },
        completedAt: null,
      },
    })

    const codeVerifier = base64UrlEncode(randomBytes(64))
    const codeChallenge = base64UrlEncode(SHA256(codeVerifier))
    const nonce = base64UrlEncode(randomBytes(32))
    const state = randomBytes(32).toString('hex')
    const scopes = this.defaultScopes
    const normalizedPurpose: GoogleOAuthPurpose = ['login', 'recover', 'reauth'].includes(purpose)
      ? purpose
      : 'login'

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    await this.prisma.storefrontOAuthSession.create({
      data: {
        id: `g-${randomUUID()}`,
        provider: OAUTH_PROVIDER,
        state,
        codeVerifier,
        nonce,
        redirectUri,
        returnPath: returnPath ?? null,
        purpose: normalizedPurpose,
        scopes,
        ipAddress: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
        expiresAt,
        expectedCustomerId: normalizedPurpose === 'reauth' ? expectedCustomerId ?? null : null,
      },
    })

    const url = new URL(GOOGLE_AUTH_ENDPOINT)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', scopes)
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('nonce', nonce)
    const prompt = normalizedPurpose === 'login' ? 'select_account' : 'consent'
    url.searchParams.set('prompt', prompt)

    return {
      url: url.toString(),
      state,
      expiresAt: expiresAt.toISOString(),
      purpose: normalizedPurpose,
    }
  }

  async complete(
    query: { state?: string | null; code?: string | null; error?: string | null; error_description?: string | null },
  ): Promise<GoogleOAuthResult> {
    const credentials = await this.requireCredentials(false)
    if (!credentials) {
      return {
        status: 'error',
        errorCode: 'not_configured',
        message: 'Google authentication is not available.',
        details: null,
        returnPath: null,
      }
    }
    const { clientId, clientSecret, redirectUri } = credentials

    const state = (query.state ?? '').trim()
    if (!state) {
      return {
        status: 'error',
        errorCode: 'missing_state',
        message: 'We could not verify the Google sign-in request. Please start again.',
        returnPath: null,
        state: null,
      }
    }

    const session = await this.prisma.storefrontOAuthSession.findUnique({ where: { state } })
    if (!session) {
      return {
        status: 'error',
        errorCode: 'session_not_found',
        message: 'The Google sign-in session has expired. Please start again.',
        returnPath: null,
        state,
      }
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.markSessionError(state, 'expired', 'The OAuth session expired before completion.')
      return {
        status: 'error',
        errorCode: 'session_expired',
        message: 'Your sign-in session expired. Please try again.',
        returnPath: session.returnPath ?? null,
        state,
      }
    }

    if (query.error) {
      await this.markSessionError(state, query.error, query.error_description ?? null)
      const message =
        query.error === 'access_denied'
          ? 'You cancelled the Google sign-in.'
          : 'Google sign-in could not be completed.'
      return {
        status: 'error',
        errorCode: query.error,
        message,
        details: query.error_description ?? null,
        returnPath: session.returnPath ?? null,
        state,
      }
    }

    const purpose = (session.purpose as GoogleOAuthPurpose | null) ?? 'login'

    if (purpose === 'reauth' && !session.expectedCustomerId) {
      await this.markSessionError(state, 'invalid_session', 'Missing expected customer context for reauthentication.')
      return {
        status: 'error',
        errorCode: 'invalid_session',
        message: 'We could not verify the Google reauthentication request. Please try again.',
        details: null,
        returnPath: session.returnPath ?? null,
        state,
        purpose,
      }
    }

    const code = (query.code ?? '').trim()
    if (!code) {
      await this.markSessionError(state, 'missing_code', 'Authorization code was not returned by Google.')
      return {
        status: 'error',
        errorCode: 'missing_code',
        message: 'Google did not return a valid authorization code. Please retry.',
        returnPath: session.returnPath ?? null,
        state,
      }
    }

    try {
      const tokenResponse = await this.exchangeAuthorizationCode({
        code,
        codeVerifier: session.codeVerifier,
        redirectUri,
        clientId,
        clientSecret,
      })

      const payload = await this.verifyIdToken(tokenResponse.id_token, {
        clientId,
        nonce: session.nonce,
      })

      const { customer, isNewCustomer } = await this.linkCustomerAccount(
        payload,
        tokenResponse.scope ?? this.defaultScopes,
        purpose,
        session.expectedCustomerId ?? null,
      )
      if (isNewCustomer && customer.email) {
        this.email
          .sendWelcome({
            customerId: customer.id,
            email: customer.email,
            locale: payload.locale ?? 'es',
            displayName: customer.name ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim(),
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            this.logger.warn(`Failed to send Google welcome email to customer ${customer.id}: ${message}`)
          })
      }
      const storefrontSession =
        purpose === 'reauth' ? null : await this.storefront.createSessionForCustomer(customer)

      let reauthToken: { token: string; expiresAt: string } | undefined
      if (purpose === 'recover' || purpose === 'reauth') {
        const context = await this.security.reauthenticateWithGoogle(
          customer.id,
          {
            sub: payload.sub,
            email: payload.email,
            scope: tokenResponse.scope ?? this.defaultScopes,
          },
          {
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
          },
        )
        reauthToken = {
          token: context.token,
          expiresAt: context.expiresAt.toISOString(),
        }
      }

      const nextAction: 'none' | 'set_password' | 'reset_password' =
        purpose === 'recover'
          ? customer.passwordHash
            ? 'reset_password'
            : 'set_password'
          : purpose === 'reauth'
            ? 'reset_password'
            : 'none'

      await this.prisma.storefrontOAuthSession.update({
        where: { state },
        data: {
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      })

      return {
        status: 'success',
        session: storefrontSession,
        returnPath: session.returnPath ?? null,
        state,
        purpose,
        profile: {
          email: payload.email,
          name: payload.name ?? null,
          picture: payload.picture ?? null,
        },
        reauthToken,
        nextAction,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Google OAuth callback failed for state "${state}": ${message}`)
      await this.markSessionError(state, 'callback_failed', message)
      return {
        status: 'error',
        errorCode: 'callback_failed',
        message: 'We could not sign you in with Google. Please try again.',
        details: message,
        returnPath: session.returnPath ?? null,
        state,
        purpose,
      }
    }
  }

  async renderCallbackPage(result: GoogleOAuthResult): Promise<string> {
    const targetOrigin = (await this.getFrontendOrigin()) ?? '*'
    const payload = JSON.stringify({
      type: 'storefront:google-auth',
      ...result,
    }).replace(/</g, '\\u003c')

    const statusText =
      result.status === 'success'
        ? 'Signing you in...'
        : 'We were unable to complete Google sign-in.'

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Google Sign-In</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
      .card { background:white; padding:24px 32px; border-radius:16px; box-shadow:0 20px 45px rgba(15,23,42,0.12); max-width:340px; text-align:center; }
      .card h1 { font-size: 18px; margin-bottom:8px; }
      .card p { font-size: 14px; color:#475569; margin:0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Google Sign-In</h1>
      <p>${statusText}</p>
    </div>
    <script>
      (function() {
        const payload = ${payload};
        const origin = ${JSON.stringify(targetOrigin)};
        const fallbackOrigin = origin !== '*' ? origin : null;
        const returnPath = typeof payload.returnPath === 'string' ? payload.returnPath : null;
        const normalizeBase = function(url) {
          if (typeof url !== 'string') return url;
          return url.endsWith('/') ? url.slice(0, -1) : url;
        };
        const scheduleClose = function(delay) {
          setTimeout(function() {
            try {
              window.close();
            } catch (closeError) {
              console.warn('[storefront] Google auth popup could not be closed immediately:', closeError);
            }
          }, delay);
        };
        const handleForceClose = function(event) {
          if (!event) return;
          var data = event.data;
          if (!data) return;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (parseError) {
              data = null;
            }
          }
          if (data && typeof data === 'object' && data.type === 'storefront:force-close-google') {
            scheduleClose(0);
          }
        };
        window.addEventListener('message', handleForceClose);
        let delivered = false;

        try {
          if (
            window.opener &&
            typeof window.opener.postMessage === 'function' &&
            window.opener.closed !== true
          ) {
            window.opener.postMessage(payload, origin);
            delivered = true;
          } else if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
            window.parent.postMessage(payload, origin);
            delivered = true;
          }
        } catch (error) {
          console.warn('[storefront] Failed to post Google auth result to opener:', error);
        } finally {
          if (delivered) {
            scheduleClose(500);
          } else if (fallbackOrigin) {
            scheduleClose(500);
            setTimeout(function() {
              if (window.closed) {
                return;
              }
              try {
                var base = normalizeBase(fallbackOrigin);
                var target = base;
                if (returnPath && returnPath.charAt(0) === '/') {
                  target = base + returnPath;
                }
                window.location.replace(target);
              } catch (redirectError) {
                console.warn('[storefront] Unable to redirect Google auth popup in fallback:', redirectError);
              }
            }, 1200);
          } else {
            scheduleClose(800);
          }
        }
      })();
    </script>
  </body>
</html>`
  }

  async buildCompletionRedirect(result: GoogleOAuthResult): Promise<string | null> {
    const frontendOrigin = await this.getFrontendOrigin()
    if (!frontendOrigin) {
      return null
    }

    try {
      const target = new URL('/auth/complete', frontendOrigin)
      target.searchParams.set('status', result.status)
      if (result.state) {
        target.searchParams.set('state', result.state)
      }

      if (result.status === 'success') {
        if (result.returnPath && result.returnPath.startsWith('/')) {
          target.searchParams.set('returnPath', result.returnPath)
        }
      } else {
        if (result.errorCode) {
          target.searchParams.set('error', result.errorCode)
        }
        if (result.message) {
          target.searchParams.set('message', result.message)
        }
        if (result.returnPath && result.returnPath.startsWith('/')) {
          target.searchParams.set('returnPath', result.returnPath)
        }
      }

      return target.toString()
    } catch (error) {
      this.logger.warn(`Failed to build Google OAuth completion redirect: ${error}`)
      return null
    }
  }

  private async requireCredentials(throwOnDisabled: true): Promise<{ clientId: string; clientSecret: string; redirectUri: string }>
  private async requireCredentials(throwOnDisabled: false): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null>
  private async requireCredentials(throwOnDisabled: boolean): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
    const config = await this.googleConfig.getEffectiveConfig()

    if (!config.google.enabled) {
      if (throwOnDisabled) {
        throw new ServiceUnavailableException('Google authentication is disabled.')
      }
      return null
    }

    if (throwOnDisabled && !config.google.storefrontEnabled) {
      throw new ServiceUnavailableException('Google authentication is not available en este entorno.')
    }

    const clientId = config.google.clientId?.trim() ?? ''
    const clientSecret = config.google.clientSecret?.trim() ?? ''
    const redirectUri = config.google.redirectUri?.trim() ?? ''

    if (!clientId || !clientSecret || !redirectUri) {
      if (throwOnDisabled) {
        throw new ServiceUnavailableException('Google authentication is not configured.')
      }
      return null
    }

    return { clientId, clientSecret, redirectUri }
  }

  private async getFrontendOrigin(): Promise<string | null> {
    const config = await this.googleConfig.getEffectiveConfig()
    const candidates = [
      config.storefrontSiteUrl,
      this.config.get<string>('STOREFRONT_BASE_URL'),
      this.config.get<string>('NEXT_PUBLIC_STOREFRONT_SITE_URL'),
      this.config.get<string>('NEXT_PUBLIC_SITE_URL'),
    ]

    for (const candidate of candidates) {
      if (!candidate) continue
      try {
        const parsed = new URL(candidate)
        return parsed.origin
      } catch (error) {
        this.logger.warn(`Invalid storefront origin candidate "${candidate}" (${error})`)
      }
    }
    return null
  }

  private async markSessionError(state: string, code: string, message: string | null) {
    try {
      await this.prisma.storefrontOAuthSession.update({
        where: { state },
        data: {
          completedAt: new Date(),
          errorCode: code,
          errorMessage: message,
        },
      })
    } catch (error) {
      this.logger.warn(`Failed to mark OAuth session error for state "${state}": ${error}`)
    }
  }

  private async exchangeAuthorizationCode(input: {
    code: string
    codeVerifier: string
    redirectUri: string
    clientId: string
    clientSecret: string
  }): Promise<GoogleTokenSuccess> {
    const params = new URLSearchParams()
    params.set('code', input.code)
    params.set('code_verifier', input.codeVerifier)
    params.set('client_id', input.clientId)
    params.set('client_secret', input.clientSecret)
    params.set('redirect_uri', input.redirectUri)
    params.set('grant_type', 'authorization_code')

    let response: Response
    try {
      response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      })
    } catch (error) {
      throw new UnauthorizedException('Could not reach Google to exchange the authorization code.')
    }

    const payload = (await response.json().catch(() => ({}))) as GoogleTokenSuccess | GoogleTokenError
    if (!response.ok) {
      const description = 'error' in payload ? payload.error_description ?? payload.error : 'Unknown error'
      throw new UnauthorizedException(`Google token exchange failed: ${description}`)
    }

    if (!('id_token' in payload) || !payload.id_token) {
      throw new UnauthorizedException('Google did not return an ID token.')
    }

    return payload
  }

  private async verifyIdToken(
    idToken: string,
    input: { clientId: string; nonce: string },
  ): Promise<{
    sub: string
    email: string
    email_verified?: boolean
    name?: string
    given_name?: string
    family_name?: string
    picture?: string
    locale?: string
  }> {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      audience: input.clientId,
      issuer: GOOGLE_ISSUERS,
    })

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Google ID token missing subject claim.')
    }

    if (!payload.email || typeof payload.email !== 'string') {
      throw new UnauthorizedException('Google account does not expose an email address.')
    }

    if (payload.nonce && payload.nonce !== input.nonce) {
      throw new UnauthorizedException('OAuth nonce mismatch. Please retry the Google sign-in.')
    }

    if (payload.email_verified === false) {
      throw new UnauthorizedException('Google did not verify this email address yet.')
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      email_verified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      given_name: typeof payload.given_name === 'string' ? payload.given_name : undefined,
      family_name: typeof payload.family_name === 'string' ? payload.family_name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      locale: typeof payload.locale === 'string' ? payload.locale : undefined,
    }
  }

  private async linkCustomerAccount(
    payload: Awaited<ReturnType<typeof this.verifyIdToken>>,
    scope: string,
    purpose: GoogleOAuthPurpose,
    expectedCustomerId?: number | null,
  ): Promise<{ customer: Customer; isNewCustomer: boolean }> {
    const now = new Date()

    return this.prisma.$transaction(async (tx) => {
      const compositeKey = {
        provider: OAUTH_PROVIDER,
        providerAccountId: payload.sub,
      } as const

      let account = await tx.customerOAuthAccount.findUnique({
        where: { provider_providerAccountId: compositeKey },
      })

      let customer: Customer | null = null
      let isNewCustomer = false
      if (account) {
        customer = await tx.customer.findUnique({ where: { id: account.customerId } })
      }

      if (!customer) {
        if (purpose === 'reauth') {
          throw new UnauthorizedException('Google account is not linked to this profile.')
        }

        customer = await tx.customer.findUnique({ where: { email: payload.email } })

        if (!customer) {
          if (purpose !== 'login') {
            throw new UnauthorizedException('No customer account matches this Google email.')
          }

          const firstName = payload.given_name ?? (payload.name ? payload.name.split(' ')[0] ?? null : null)
          const lastName =
            payload.family_name ??
            (payload.name
              ? payload.name
                  .split(' ')
                  .slice(1)
                  .join(' ')
                  .trim() || null
              : null)
          const displayName = payload.name ?? [firstName, lastName].filter(Boolean).join(' ').trim()

          customer = await tx.customer.create({
            data: {
              email: payload.email,
              emailVerifiedAt: payload.email_verified ? now : null,
              firstName,
              lastName,
              name: displayName || payload.email,
              img: payload.picture ?? null,
              storefrontDefaultPasswordHash: null,
            },
          })
          isNewCustomer = true
        } else {
          const updateData: Record<string, unknown> = { updatedAt: now }
          updateData.storefrontDefaultPasswordHash = null
          if (!customer.emailVerifiedAt && payload.email_verified) {
            updateData.emailVerifiedAt = now
          }
          if (!customer.firstName && payload.given_name) updateData.firstName = payload.given_name
          if (!customer.lastName && payload.family_name) updateData.lastName = payload.family_name
          if (!customer.name) {
            const displayName = payload.name ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
            if (displayName) updateData.name = displayName
          }
          if (payload.picture && !customer.img) {
            updateData.img = payload.picture
          }

          if (Object.keys(updateData).length > 1) {
            customer = await tx.customer.update({
              where: { id: customer.id },
              data: updateData,
            })
          }
        }
      } else {
        if (purpose !== 'reauth') {
          const updateData: Record<string, unknown> = { updatedAt: now }
          updateData.storefrontDefaultPasswordHash = null
          if (!customer.emailVerifiedAt && payload.email_verified) {
            updateData.emailVerifiedAt = now
          }
          if (!customer.firstName && payload.given_name) updateData.firstName = payload.given_name
          if (!customer.lastName && payload.family_name) updateData.lastName = payload.family_name
          if (!customer.name) {
            const displayName = payload.name ?? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
            if (displayName) updateData.name = displayName
          }
          if (payload.picture && !customer.img) {
            updateData.img = payload.picture
          }

          if (Object.keys(updateData).length > 1) {
            customer = await tx.customer.update({
              where: { id: customer.id },
              data: updateData,
            })
          }
        }
      }

      if (!customer) {
        throw new UnauthorizedException('Unable to resolve customer account for Google login.')
      }

      if (expectedCustomerId && customer.id !== expectedCustomerId) {
        throw new UnauthorizedException('Google account does not match the active session.')
      }

      account = await tx.customerOAuthAccount.upsert({
        where: { provider_providerAccountId: compositeKey },
        create: {
          provider: OAUTH_PROVIDER,
          providerAccountId: payload.sub,
          customer: { connect: { id: customer.id } },
          email: payload.email,
          name: payload.name ?? null,
          givenName: payload.given_name ?? null,
          familyName: payload.family_name ?? null,
          picture: payload.picture ?? null,
          metadata: {
            scope,
            locale: payload.locale ?? null,
          },
          lastLoginAt: now,
        },
        update: {
          email: payload.email,
          name: payload.name ?? null,
          givenName: payload.given_name ?? null,
          familyName: payload.family_name ?? null,
          picture: payload.picture ?? null,
          metadata: {
            scope,
            locale: payload.locale ?? null,
          },
          lastLoginAt: now,
        },
      })

      const resolvedCustomer = await tx.customer.findUniqueOrThrow({ where: { id: account.customerId } })
      return { customer: resolvedCustomer, isNewCustomer }
    })
  }
}
