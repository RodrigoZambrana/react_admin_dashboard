import { Injectable } from '@nestjs/common'

type SmsTemplateKey = 'verification' | 'recovery'

@Injectable()
export class SmsTemplateService {
  render(key: SmsTemplateKey, params: { code: string; ttlMinutes: number; appName?: string; locale?: string }) {
    const appName = params.appName ?? 'Tu cuenta'
    const ttlText = `${params.ttlMinutes} min`
    switch (key) {
      case 'recovery':
        return `[#${appName}] Tu código de recuperación es ${params.code}. Vence en ${ttlText}. Si no pediste esto, ignora este mensaje.`
      case 'verification':
      default:
        return `[#${appName}] Tu código de verificación es ${params.code}. Vence en ${ttlText}.`
    }
  }
}

