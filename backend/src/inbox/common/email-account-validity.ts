import { ConfigService } from '@nestjs/config'
import { InboxAccount, InboxChannelType } from '@prisma/client'

type MinimalInboxAccount = Pick<
  InboxAccount,
  'active' | 'address' | 'channel' | 'metadata'
>

type InboxValidationMetadata = {
  smtpTlsVerifiedAt: string | null
  imapTlsVerifiedAt: string | null
  smtpVerifyVerifiedAt: string | null
  verifiedAt: string | null
}

export type EmailInboxAccountValidity = {
  isOperational: boolean
  isConfiguredAddress: boolean
  hasStoredConfiguration: boolean
  hasConnectivityProof: boolean
  normalizedAddress: string | null
  configuredAddress: string | null
  validation: InboxValidationMetadata
}

export const asMetadataRecord = (
  value: unknown,
): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const toOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

export const resolveConfiguredEmailInboxAddress = (
  configService: ConfigService,
) => {
  const candidate =
    configService.get<string>('INBOX_EMAIL_DEFAULT_FROM') ||
    configService.get<string>('INBOX_EMAIL_USER') ||
    ''

  const normalized = candidate.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export const getEmailInboxAccountValidity = (
  account: MinimalInboxAccount | null | undefined,
  configService: ConfigService,
): EmailInboxAccountValidity => {
  const configuredAddress = resolveConfiguredEmailInboxAddress(configService)
  const normalizedAddress = account?.address?.trim().toLowerCase() || null

  const emptyValidation: InboxValidationMetadata = {
    smtpTlsVerifiedAt: null,
    imapTlsVerifiedAt: null,
    smtpVerifyVerifiedAt: null,
    verifiedAt: null,
  }

  if (!account || account.channel !== InboxChannelType.EMAIL) {
    return {
      isOperational: false,
      isConfiguredAddress: false,
      hasStoredConfiguration: false,
      hasConnectivityProof: false,
      normalizedAddress,
      configuredAddress,
      validation: emptyValidation,
    }
  }

  const metadata = asMetadataRecord(account.metadata)
  const imap = asMetadataRecord(metadata?.imap)
  const smtp = asMetadataRecord(metadata?.smtp)
  const defaults = asMetadataRecord(metadata?.defaults)
  const validationRecord =
    asMetadataRecord(metadata?.validation) ||
    asMetadataRecord(metadata?.verification)

  const validation: InboxValidationMetadata = {
    smtpTlsVerifiedAt: toOptionalString(validationRecord?.smtpTlsVerifiedAt),
    imapTlsVerifiedAt: toOptionalString(validationRecord?.imapTlsVerifiedAt),
    smtpVerifyVerifiedAt: toOptionalString(validationRecord?.smtpVerifyVerifiedAt),
    verifiedAt: toOptionalString(validationRecord?.verifiedAt),
  }

  const isConfiguredAddress = Boolean(
    configuredAddress && normalizedAddress === configuredAddress,
  )

  const hasStoredConfiguration = Boolean(
    normalizedAddress &&
      typeof imap?.host === 'string' &&
      imap.host.trim().length > 0 &&
      typeof smtp?.host === 'string' &&
      smtp.host.trim().length > 0 &&
      typeof defaults?.fromAddress === 'string' &&
      defaults.fromAddress.trim().length > 0,
  )

  const hasConnectivityProof = Boolean(
    validation.smtpTlsVerifiedAt &&
      validation.imapTlsVerifiedAt &&
      validation.smtpVerifyVerifiedAt,
  )

  return {
    isOperational: Boolean(
      account.active &&
        normalizedAddress &&
        (isConfiguredAddress || hasStoredConfiguration) &&
        hasConnectivityProof,
    ),
    isConfiguredAddress,
    hasStoredConfiguration,
    hasConnectivityProof,
    normalizedAddress,
    configuredAddress,
    validation,
  }
}

export const isOperationalEmailInboxAccount = (
  account: MinimalInboxAccount | null | undefined,
  configService: ConfigService,
) => getEmailInboxAccountValidity(account, configService).isOperational
