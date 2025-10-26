"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertStrongPassword = void 0;
const common_1 = require("@nestjs/common");
const password_strength_decorator_1 = require("./password-strength.decorator");
const assertStrongPassword = (password, field) => {
    if (!password_strength_decorator_1.PASSWORD_REGEX.test(password)) {
        throw new common_1.BadRequestException({
            message: password_strength_decorator_1.PASSWORD_MESSAGE_KEY,
            errors: [{ field, key: password_strength_decorator_1.PASSWORD_MESSAGE_KEY }],
        });
    }
};
exports.assertStrongPassword = assertStrongPassword;
//# sourceMappingURL=assert-strong-password.js.map