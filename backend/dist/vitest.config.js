"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        environment: 'node',
        include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
        coverage: {
            reporter: ['text', 'lcov'],
        },
    },
});
//# sourceMappingURL=vitest.config.js.map