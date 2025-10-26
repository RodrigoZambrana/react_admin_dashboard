"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsSafeString = IsSafeString;
const class_validator_1 = require("class-validator");
const patterns_1 = require("./patterns");
function IsSafeString(validationOptions) {
    return (object, propertyName) => {
        const { each, ...optionsWithoutEach } = validationOptions ?? {};
        (0, class_validator_1.registerDecorator)({
            name: 'isSafeString',
            target: object.constructor,
            propertyName,
            options: {
                message: 'text.validation.invalidCharacters',
                ...optionsWithoutEach,
            },
            constraints: [],
            validator: {
                validate(value) {
                    if (value === null || value === undefined) {
                        return true;
                    }
                    if (typeof value !== 'string') {
                        return false;
                    }
                    return patterns_1.SAFE_TEXT_REGEX.test(value);
                },
            },
            ...(each ? { each: true } : {}),
        });
    };
}
//# sourceMappingURL=is-safe-string.decorator.js.map