import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { EmailCategory, EmailTemplate, EmailTemplateVariant } from '@prisma/client'
import { TEMPLATE_DEFINITIONS, TemplateDefinition } from './templates/definitions'
import { EmailRenderContext } from './email.types'
import Handlebars from 'handlebars'
import mjml2html from 'mjml'
import { htmlToText } from 'html-to-text'

type CompiledTemplate = {
  id: number
  locale: string
  category: EmailCategory
  variant: EmailTemplateVariant
  subjectCompiler: Handlebars.TemplateDelegate
  bodyCompiler: Handlebars.TemplateDelegate
  version: number
}

type RenderResult = {
  subject: string
  html: string
  text: string
  locale: string
  templateId?: number
}

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name)
  private readonly hbs = Handlebars.create()
  private templateCache = new Map<string, CompiledTemplate>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.registerHelpers()
  }

  async onModuleInit() {
    await this.synchronizeStaticTemplates()
    await this.reloadActiveTemplates()
  }

  private registerHelpers() {
    this.hbs.registerHelper('uppercase', (value?: string | null) => (value ? String(value).toUpperCase() : ''))
    this.hbs.registerHelper('lowercase', (value?: string | null) => (value ? String(value).toLowerCase() : ''))
    this.hbs.registerHelper('default', (value: unknown, fallback: unknown) =>
      value === undefined || value === null || value === '' ? fallback : value,
    )
  }

  private async synchronizeStaticTemplates() {
    const existing = await this.prisma.emailTemplate.findMany()
    const existingMap = new Map<string, EmailTemplate>()
    for (const template of existing) {
      existingMap.set(this.makeTemplateKey(template.category, template.variant, template.locale, template.version), template)
    }

    for (const def of TEMPLATE_DEFINITIONS) {
      const key = this.makeTemplateKey(def.category, def.variant, def.locale, def.version)
      const existingTemplate = existingMap.get(key)
      if (!existingTemplate) {
        await this.prisma.emailTemplate.create({
          data: {
            category: def.category,
            variant: def.variant,
            locale: def.locale,
            version: def.version,
            subject: def.subject,
            body: def.body,
            active: true,
          },
        })
      } else if (
        existingTemplate.subject !== def.subject ||
        existingTemplate.body !== def.body ||
        existingTemplate.active === false
      ) {
        await this.prisma.emailTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            subject: def.subject,
            body: def.body,
            active: true,
          },
        })
      }

      await this.prisma.emailTemplate.updateMany({
        where: {
          category: def.category,
          variant: def.variant,
          locale: def.locale,
          version: { not: def.version },
          active: true,
        },
        data: { active: false },
      })
    }
  }

  private makeTemplateKey(category: EmailCategory, variant: EmailTemplateVariant, locale: string, version: number) {
    return `${category}:${variant}:${locale}:${version}`
  }

  private makeCacheKey(category: EmailCategory, variant: EmailTemplateVariant, locale: string) {
    return `${category}:${variant}:${locale}`
  }

  private async reloadActiveTemplates() {
    const templates = await this.prisma.emailTemplate.findMany({
      where: { active: true },
    })

    const newCache = new Map<string, CompiledTemplate>()
    for (const template of templates) {
      try {
        const compiled = this.compileTemplate(template)
        newCache.set(this.makeCacheKey(template.category, template.variant, template.locale), compiled)
      } catch (error) {
        this.logger.error(`Failed to compile email template ${template.id}: ${(error as Error).message}`)
      }
    }
    this.templateCache = newCache
    this.logger.log(`Loaded ${this.templateCache.size} email templates into cache`)
  }

  private compileTemplate(template: EmailTemplate): CompiledTemplate {
    const subjectCompiler = this.hbs.compile(template.subject, { noEscape: false })
    const bodyCompiler = this.hbs.compile(template.body, { noEscape: false })
    return {
      id: template.id,
      locale: template.locale,
      category: template.category,
      variant: template.variant,
      subjectCompiler,
      bodyCompiler,
      version: template.version,
    }
  }

  private findTemplate(category: EmailCategory, variant: EmailTemplateVariant, locale: string): CompiledTemplate | null {
    const key = this.makeCacheKey(category, variant, locale)
    if (this.templateCache.has(key)) {
      return this.templateCache.get(key) ?? null
    }
    const defaultLocale = this.config.get<string>('DEFAULT_EMAIL_LOCALE') || 'en'
    const fallbackKey = this.makeCacheKey(category, variant, defaultLocale)
    if (this.templateCache.has(fallbackKey)) {
      return this.templateCache.get(fallbackKey) ?? null
    }
    return null
  }

  async render(context: EmailRenderContext, extras?: Record<string, unknown>): Promise<RenderResult> {
    const template = this.findTemplate(context.category, context.variant, context.payload.locale) ?? this.findTemplate(context.category, context.variant, 'en')
    if (!template) {
      throw new Error(`No email template found for category=${context.category} variant=${context.variant}`)
    }

    const baseContext = {
      payload: context.payload,
      companyName: extras?.companyName ?? this.config.get<string>('COMPANY_NAME') ?? 'Sistema Administrativo',
      companyFooter:
        extras?.companyFooter ??
        this.config.get<string>('COMPANY_EMAIL_FOOTER') ??
        'You are receiving this email because you have an active account with us.',
    }

    const subject = template.subjectCompiler(baseContext)
    const mjmlMarkup = template.bodyCompiler(baseContext)
    const result = mjml2html(mjmlMarkup, {
      validationLevel: 'soft',
      fonts: {
        Inter: 'https://fonts.googleapis.com/css?family=Inter',
      },
    })
    if (result.errors && result.errors.length) {
      this.logger.warn(
        `MJML compilation for template ${template.id} produced warnings: ${result.errors
          .map((error) => error.formattedMessage ?? error.message)
          .join('; ')}`,
      )
    }
    if (!result.html) {
      throw new Error(`Failed to compile MJML template ${template.id}`)
    }
    const text = htmlToText(result.html, {
      wordwrap: 80,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' },
      ],
    })

    return {
      subject,
      html: result.html,
      text,
      locale: template.locale,
      templateId: template.id,
    }
  }

  async reloadTemplates() {
    await this.reloadActiveTemplates()
  }

  async listActiveTemplates() {
    return this.prisma.emailTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        category: true,
        variant: true,
        locale: true,
        version: true,
        updatedAt: true,
      },
      orderBy: [
        { category: 'asc' },
        { variant: 'asc' },
        { locale: 'asc' },
      ],
    })
  }
}
