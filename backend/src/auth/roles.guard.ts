import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, Role } from './roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }
    const request = context.switchToHttp().getRequest()
    const user = request.user as { role?: Role; authority?: Role[] }
    if (!user) throw new UnauthorizedException()
    const roles = user.authority || (user.role ? [user.role] : [])
    return requiredRoles.some((r) => roles.includes(r))
  }
}

