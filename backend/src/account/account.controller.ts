import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  @Get('setting')
  setting() {
    return { profile: { email: 'admin@example.com', name: 'Admin' } }
  }

  @Get('setting/integration')
  integration() {
    return { providers: [] }
  }

  @Get('setting/billing')
  billing() {
    return { plans: [] }
  }

  @Get('invoice')
  invoice(@Query('id') id: string) {
    return { id, items: [] }
  }

  @Post('log')
  log(@Body() _body: any) {
    return { ok: true }
  }

  @Get('form')
  form() {
    return { kyc: {} }
  }
}

