import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  private readonly accountLogs = [
    {
      id: '2024-10-04',
      date: Math.floor(new Date('2024-10-04T00:00:00Z').getTime() / 1000),
      events: [
        {
          type: 'LOGIN',
          dateTime: Math.floor(new Date('2024-10-04T08:15:00Z').getTime() / 1000),
          userName: 'Admin',
          description: 'Signed in successfully from Montevideo, UY.',
          metadata: {
            device: 'Chrome on macOS',
            location: 'Montevideo, UY',
            ipAddress: '181.176.0.12',
            browser: 'Chrome 128',
            platform: 'macOS 14.5',
          },
        },
        {
          type: 'PASSWORD-CHANGE',
          dateTime: Math.floor(new Date('2024-10-04T08:20:00Z').getTime() / 1000),
          userName: 'Admin',
          metadata: {
            method: 'Self-service',
            ipAddress: '181.176.0.12',
          },
        },
      ],
    },
    {
      id: '2024-10-03',
      date: Math.floor(new Date('2024-10-03T00:00:00Z').getTime() / 1000),
      events: [
        {
          type: 'DEVICE-SIGN-IN',
          dateTime: Math.floor(new Date('2024-10-03T19:42:00Z').getTime() / 1000),
          userName: 'Admin',
          description: 'New device registered for the account.',
          metadata: {
            device: 'Safari on iPhone 15 Pro',
            location: 'Punta del Este, UY',
            ipAddress: '191.0.24.45',
          },
        },
        {
          type: 'PROFILE-UPDATE',
          dateTime: Math.floor(new Date('2024-10-03T19:55:00Z').getTime() / 1000),
          userName: 'Admin',
          metadata: {
            fields: 'Phone number, Preferred language',
          },
        },
      ],
    },
    {
      id: '2024-10-02',
      date: Math.floor(new Date('2024-10-02T00:00:00Z').getTime() / 1000),
      events: [
        {
          type: 'SECURITY-ALERT',
          dateTime: Math.floor(new Date('2024-10-02T02:17:00Z').getTime() / 1000),
          userName: 'System',
          description: 'Suspicious login attempt blocked.',
          metadata: {
            location: 'São Paulo, BR',
            ipAddress: '177.92.11.32',
            device: 'Edge on Windows',
          },
        },
      ],
    },
    {
      id: '2024-10-01',
      date: Math.floor(new Date('2024-10-01T00:00:00Z').getTime() / 1000),
      events: [
        {
          type: 'PROFILE-UPDATE',
          dateTime: Math.floor(new Date('2024-10-01T11:08:00Z').getTime() / 1000),
          userName: 'Admin',
          description: 'Updated billing address information.',
        },
        {
          type: 'LOGIN',
          dateTime: Math.floor(new Date('2024-10-01T07:55:00Z').getTime() / 1000),
          userName: 'Admin',
          metadata: {
            device: 'Firefox on Ubuntu',
            location: 'Montevideo, UY',
            ipAddress: '181.176.0.12',
          },
        },
      ],
    },
  ]

  @Get('setting')
  setting(@Request() req: any) {
    const email = req?.user?.email || 'admin@example.com'
    const name = req?.user?.name || 'Admin'
    const lastName = req?.user?.lastName || ''
    return {
      profile: {
        email,
        name,
        lastName,
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
  log(@Body() body: { filter?: string[]; activityIndex?: number }) {
    const filters = Array.isArray(body?.filter) && body.filter.length > 0 ? body.filter : null
    const page = Number(body?.activityIndex) || 1
    const pageSize = 2
    const start = (page - 1) * pageSize
    const end = start + pageSize

    const slice = this.accountLogs.slice(start, end)

    const filtered = slice
      .map((log) => ({
        ...log,
        events: filters
          ? log.events.filter((event) => filters.includes(event.type))
          : log.events,
      }))
      .filter((log) => log.events.length > 0)

    const loadable = end < this.accountLogs.length

    return {
      data: filtered,
      loadable,
    }
  }

  @Get('form')
  form() {
    return { kyc: {} }
  }
}
