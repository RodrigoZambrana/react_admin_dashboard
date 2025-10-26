"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteShippingLogo = exports.persistShippingLogo = exports.normalizeShippingLogoPath = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const ALLOWED_LOGO_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
]);
const LOGO_MIME_EXTENSION = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
};
const UPLOADS_ROOT = (0, path_1.join)(process.cwd(), 'uploads');
const SHIPPING_LOGO_DIR = (0, path_1.join)(UPLOADS_ROOT, 'shipping');
const isLocalUploadPath = (value) => Boolean(value && value.startsWith('/uploads/'));
const resolveLocalUploadPath = (value) => {
    const relative = value.replace(/^\/uploads\//, '');
    return (0, path_1.join)(UPLOADS_ROOT, relative);
};
const normalizeShippingLogoPath = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};
exports.normalizeShippingLogoPath = normalizeShippingLogoPath;
const persistShippingLogo = async (file, previous) => {
    if (!ALLOWED_LOGO_MIME.has(file.mimetype)) {
        throw new common_1.BadRequestException({
            message: 'settings.shippingOptions.invalidImageType',
        });
    }
    const original = file.filename || file.originalname || 'shipping-logo';
    const ext = (0, path_1.extname)(original) || LOGO_MIME_EXTENSION[file.mimetype] || '.png';
    const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
    const fileName = `${(0, crypto_1.randomUUID)()}${safeExt.toLowerCase()}`;
    await (0, promises_1.mkdir)(SHIPPING_LOGO_DIR, { recursive: true });
    const buffer = typeof file.toBuffer === 'function'
        ? await file.toBuffer()
        : await collectStreamBuffer(file.file);
    await (0, promises_1.writeFile)((0, path_1.join)(SHIPPING_LOGO_DIR, fileName), buffer);
    if (previous && isLocalUploadPath(previous)) {
        try {
            await (0, promises_1.unlink)(resolveLocalUploadPath(previous));
        }
        catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    return `/uploads/shipping/${fileName}`;
};
exports.persistShippingLogo = persistShippingLogo;
const deleteShippingLogo = async (value) => {
    const normalized = (0, exports.normalizeShippingLogoPath)(value);
    if (!normalized || !isLocalUploadPath(normalized)) {
        return;
    }
    try {
        await (0, promises_1.unlink)(resolveLocalUploadPath(normalized));
    }
    catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
};
exports.deleteShippingLogo = deleteShippingLogo;
const collectStreamBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
};
//# sourceMappingURL=shipping.js.map