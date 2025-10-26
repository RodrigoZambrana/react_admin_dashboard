"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const helmet_1 = require("@fastify/helmet");
const cors_1 = require("@fastify/cors");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const multipart_1 = require("@fastify/multipart");
const static_1 = require("@fastify/static");
const path_1 = require("path");
const cookie_1 = require("@fastify/cookie");
const sanitize_input_pipe_1 = require("./common/pipes/sanitize-input.pipe");
async function bootstrap() {
    const BODY_LIMIT_BYTES = 15 * 1024 * 1024;
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ logger: true, bodyLimit: BODY_LIMIT_BYTES }));
    await app.register(helmet_1.default);
    const defaultAllowedOrigins = ['http://localhost:5173'];
    const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));
    await app.register(cors_1.default, {
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes('*')) {
                cb(null, true);
                return;
            }
            if (allowedOrigins.some((allowed) => origin === allowed || origin.endsWith(allowed))) {
                cb(null, true);
                return;
            }
            cb(new Error('Origin not allowed'), false);
        },
        credentials: true,
    });
    await app.register(cookie_1.default, {
        secret: process.env.COOKIE_SECRET || 'dev-cookie-secret',
    });
    await app.register(multipart_1.default, {
        limits: {
            fileSize: BODY_LIMIT_BYTES,
        },
    });
    await app.register(static_1.default, {
        root: (0, path_1.join)(process.cwd(), 'uploads'),
        prefix: '/uploads/',
        decorateReply: false,
    });
    app.setGlobalPrefix('api');
    const exceptionFactory = (errors) => {
        const flat = [];
        const walk = (errs, parent = '') => {
            for (const e of errs) {
                const path = parent ? `${parent}.${e.property}` : e.property;
                if (e.constraints && Object.keys(e.constraints).length) {
                    const constraintKeys = Object.keys(e.constraints);
                    let key = '';
                    if (path === 'customerId')
                        key = 'sales.orders.validation.customerRequired';
                    if (path.startsWith('items'))
                        key = 'sales.orders.validation.itemsRequired';
                    if (!key)
                        key = 'validation.fieldInvalid';
                    flat.push({ field: path, key, constraints: e.constraints });
                }
                if (e.children && e.children.length)
                    walk(e.children, path);
            }
        };
        walk(errors);
        return new common_1.BadRequestException({ message: 'validation.failed', errors: flat });
    };
    app.useGlobalPipes(new sanitize_input_pipe_1.SanitizeInputPipe(), new common_1.ValidationPipe({ whitelist: true, transform: true, exceptionFactory }));
    const port = Number(process.env.PORT || 4000);
    await app.listen({ port, host: '0.0.0.0' });
}
bootstrap();
//# sourceMappingURL=main.js.map