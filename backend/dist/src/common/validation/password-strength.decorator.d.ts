import { ValidationOptions } from 'class-validator';
export declare const PASSWORD_REGEX: RegExp;
export declare const PASSWORD_MESSAGE_KEY = "text.validation.passwordComplexity";
export declare function IsStrongPassword(validationOptions?: ValidationOptions): (object: object, propertyName: string) => void;
