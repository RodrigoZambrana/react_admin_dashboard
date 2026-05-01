import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CloudinarySignService } from './cloudinary-sign.service'
import { CloudinarySignUploadDto, CloudinarySignUploadResponse } from './cloudinary-upload.dto'

@Controller('cloudinary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class CloudinaryController {
  constructor(private readonly signService: CloudinarySignService) {}

  @Post('sign')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sign(
    @Body() dto: CloudinarySignUploadDto,
  ): Promise<CloudinarySignUploadResponse> {
    return this.signService.createUploadSignature(dto)
  }
}
