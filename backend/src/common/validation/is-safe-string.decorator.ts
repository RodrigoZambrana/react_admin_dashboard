import { registerDecorator, ValidationOptions } from 'class-validator'
import { SAFE_TEXT_REGEX } from './patterns'

export function IsSafeString(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    const { each, ...optionsWithoutEach } = validationOptions ?? {}

    registerDecorator({
      name: 'isSafeString',
      target: object.constructor,
      propertyName,
      options: {
        message: 'text.validation.invalidCharacters',
        ...optionsWithoutEach,
      },
      constraints: [],
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined) {
            return true
          }
          if (typeof value !== 'string') {
            return false
          }
          return SAFE_TEXT_REGEX.test(value)
        },
      },
      ...(each ? { each: true } : {}),
    })
  }
}

