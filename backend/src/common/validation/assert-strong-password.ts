import { BadRequestException } from '@nestjs/common'
import { PASSWORD_REGEX, PASSWORD_MESSAGE_KEY } from './password-strength.decorator'

export const assertStrongPassword = (password: string, field: string) => {
  if (!PASSWORD_REGEX.test(password)) {
    throw new BadRequestException({
      message: PASSWORD_MESSAGE_KEY,
      errors: [{ field, key: PASSWORD_MESSAGE_KEY }],
    })
  }
}

