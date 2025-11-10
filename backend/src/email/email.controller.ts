import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { EmailService } from './email.service'
import { TestEmailDto } from './dto/test-email.dto'
import { EmailRecipientType, EmailTemplateVariant } from '@prisma/client'
import { EmailSettingsService } from './email-settings.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  @Post('test')
  async sendTestEmail(@Body() dto: TestEmailDto) {
    const variant = dto.variant ?? EmailTemplateVariant.CUSTOMER
    const recipientType = variant === EmailTemplateVariant.ADMIN ? EmailRecipientType.ADMIN : EmailRecipientType.CUSTOMER
    const deliveryEnabled = await this.emailSettings.isRecipientDeliveryEnabled(recipientType)
    if (!deliveryEnabled) {
      const targetLabel =
        recipientType === EmailRecipientType.ADMIN ? 'Admin email delivery' : 'Customer email delivery'
      throw new BadRequestException(`${targetLabel} is disabled. Enable it to send test emails.`)
    }
    await this.emailService.sendTestEmail(dto)
    return { ok: true }
  }
}
