import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  @Get('setting')
  setting(@Request() req: any) {
    const email = req?.user?.email || 'admin@example.com'
    const name = req?.user?.name || 'Admin'
    return {
      profile: {
        email,
        name,
        avatar: '/img/avatars/thumb-1.jpg',
        lang: 'en',
      },
      loginHistory: [
        {
          type: 'Desktop',
          deviceName: 'MacBook Pro',
          time: Math.floor(Date.now() / 1000),
          location: 'Montevideo, UY',
        },
        {
          type: 'Mobile',
          deviceName: 'iPhone 14',
          time: Math.floor((Date.now() - 3600 * 24) / 1000),
          location: 'Buenos Aires, AR',
        },
      ],
    }
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
