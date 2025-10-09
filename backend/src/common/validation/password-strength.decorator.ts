import { registerDecorator, ValidationOptions } from 'class-validator'

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/

export const PASSWORD_MESSAGE_KEY = 'text.validation.passwordComplexity'

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: {
        message: PASSWORD_MESSAGE_KEY,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false
          return PASSWORD_REGEX.test(value)
        },
      },
    })
  }
}

