"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_MESSAGE_KEY = exports.PASSWORD_REGEX = void 0;
exports.IsStrongPassword = IsStrongPassword;
const class_validator_1 = require("class-validator");
exports.PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
exports.PASSWORD_MESSAGE_KEY = 'text.validation.passwordComplexity';
function IsStrongPassword(validationOptions) {
    return (object, propertyName) => {
        (0, class_validator_1.registerDecorator)({
            name: 'isStrongPassword',
            target: object.constructor,
            propertyName,
            options: {
                message: exports.PASSWORD_MESSAGE_KEY,
                ...validationOptions,
            },
            validator: {
                validate(value) {
                    if (typeof value !== 'string')
                        return false;
                    return exports.PASSWORD_REGEX.test(value);
                },
            },
        });
    };
}
//# sourceMappingURL=password-strength.decorator.js.map