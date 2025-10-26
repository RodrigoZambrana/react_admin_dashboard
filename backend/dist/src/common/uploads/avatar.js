"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAvatarPublicUrl = exports.normalizeAvatarPath = exports.persistAvatarFile = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const ALLOWED_AVATAR_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const AVATAR_MIME_EXTENSION = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};
const UPLOADS_ROOT = (0, path_1.join)(process.cwd(), 'uploads');
const USER_AVATAR_DIR = (0, path_1.join)(UPLOADS_ROOT, 'users');
const isLocalUploadPath = (value) => Boolean(value && value.startsWith('/uploads/'));
const resolveLocalUploadPath = (value) => {
    const relative = value.replace(/^\/uploads\//, '');
    return (0, path_1.join)(UPLOADS_ROOT, relative);
};
const persistAvatarFile = async (file, previous) => {
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
        throw new common_1.BadRequestException({
            message: 'account.settings.profile.invalidAvatarType',
        });
    }
    const original = file.filename || file.originalname || 'avatar';
    const ext = (0, path_1.extname)(original) || AVATAR_MIME_EXTENSION[file.mimetype] || '.png';
    const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
    const fileName = `${(0, crypto_1.randomUUID)()}${safeExt.toLowerCase()}`;
    await (0, promises_1.mkdir)(USER_AVATAR_DIR, { recursive: true });
    const buffer = typeof file.toBuffer === 'function'
        ? await file.toBuffer()
        : await collectStreamBuffer(file.file);
    await (0, promises_1.writeFile)((0, path_1.join)(USER_AVATAR_DIR, fileName), buffer);
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
    return `/uploads/users/${fileName}`;
};
exports.persistAvatarFile = persistAvatarFile;
const normalizeAvatarPath = (value) => value && value.trim() ? value.trim() : null;
exports.normalizeAvatarPath = normalizeAvatarPath;
const getHeaderValue = (value) => Array.isArray(value) ? value[0] : value;
const parseOrigin = (raw) => {
    if (!raw) {
        return null;
    }
    try {
        const url = new URL(raw);
        return url.origin;
    }
    catch (error) {
        try {
            const url = new URL(raw, 'http://placeholder');
            return `${url.protocol}//${url.host}`;
        }
        catch {
            return null;
        }
    }
};
const buildRequestOrigin = (req) => {
    const originHeader = parseOrigin(getHeaderValue(req.headers.origin));
    if (originHeader) {
        return originHeader;
    }
    const refererHeader = parseOrigin(getHeaderValue(req.headers.referer));
    if (refererHeader) {
        return refererHeader;
    }
    const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto']);
    const forwardedHost = getHeaderValue(req.headers['x-forwarded-host']);
    const forwardedPort = getHeaderValue(req.headers['x-forwarded-port']);
    const protocol = forwardedProto || req.protocol || 'http';
    const hostHeader = forwardedHost || getHeaderValue(req.headers.host);
    if (!hostHeader) {
        return null;
    }
    if (hostHeader.includes(':') || !forwardedPort) {
        return `${protocol}://${hostHeader}`;
    }
    return `${protocol}://${hostHeader}:${forwardedPort}`;
};
const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);
const resolveAvatarPublicUrl = (req, value) => {
    const normalized = (0, exports.normalizeAvatarPath)(value);
    if (!normalized) {
        return '';
    }
    if (isAbsoluteUrl(normalized) || !normalized.startsWith('/uploads/')) {
        return normalized;
    }
    const origin = buildRequestOrigin(req);
    if (!origin) {
        return normalized;
    }
    return `${origin}${normalized}`;
};
exports.resolveAvatarPublicUrl = resolveAvatarPublicUrl;
const collectStreamBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
};
//# sourceMappingURL=avatar.js.map