"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRichText = exports.sanitizeInput = exports.sanitizeHtml = void 0;
const common_1 = require("@nestjs/common");
const xss_1 = require("xss");
const BLOCKED_PATTERNS = [
    /('|\")\s*or\s+(\d+|true|false|null)/i,
    /\bUNION\b\s+\bSELECT\b/i,
    /\bDROP\b\s+\bTABLE\b/i,
    /\bTRUNCATE\b\s+\bTABLE\b/i,
    /\bALTER\b\s+\bTABLE\b/i,
    /\bEXEC(UTE)?\b/i,
    /\bINSERT\b\s+\bINTO\b/i,
    /\bDELETE\b\s+\bFROM\b/i,
    /\bUPDATE\b\s+\bSET\b/i,
    /--/,
    /\/\*/,
    /\*\//,
    /<[^>]+>/,
];
const baseXssOptions = {
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
};
const plainTextOptions = {
    ...baseXssOptions,
    whiteList: {},
};
const richTextOptions = {
    ...baseXssOptions,
    whiteList: {
        a: ['href', 'target', 'rel', 'title'],
        abbr: ['title'],
        b: [],
        blockquote: ['class'],
        br: [],
        code: ['class'],
        div: ['class'],
        em: [],
        h1: ['class'],
        h2: ['class'],
        h3: ['class'],
        h4: ['class'],
        h5: ['class'],
        h6: ['class'],
        i: ['class'],
        li: ['class'],
        ol: ['class'],
        p: ['class'],
        pre: ['class'],
        s: [],
        span: ['class'],
        strong: ['class'],
        sub: [],
        sup: [],
        u: [],
        ul: ['class'],
    },
};
const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
const sanitizeString = (value, path) => {
    const sanitized = (0, xss_1.filterXSS)(value, plainTextOptions).trim();
    const normalized = sanitized.replace(/\s+/g, ' ').toUpperCase();
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
        throw new common_1.BadRequestException({
            message: 'text.validation.invalidCharacters',
            errors: [{ field: path ?? 'payload', key: 'text.validation.invalidCharacters' }],
        });
    }
    return sanitized;
};
const sanitizeHtml = (value, path) => {
    const sanitized = (0, xss_1.filterXSS)(value, richTextOptions).trim();
    const normalized = sanitized
        .replace(/<br\s*\/?>(?=\n|$)/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .toUpperCase();
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized))) {
        throw new common_1.BadRequestException({
            message: 'text.validation.invalidCharacters',
            errors: [{ field: path ?? 'payload', key: 'text.validation.invalidCharacters' }],
        });
    }
    return sanitized;
};
exports.sanitizeHtml = sanitizeHtml;
const sanitizeInput = (payload, currentPath = '') => {
    if (payload === null || payload === undefined) {
        return payload;
    }
    if (typeof payload === 'string') {
        return sanitizeString(payload, currentPath);
    }
    if (Array.isArray(payload)) {
        return payload.map((item, index) => (0, exports.sanitizeInput)(item, `${currentPath}[${index}]`));
    }
    if (isPlainObject(payload)) {
        const result = {};
        Object.entries(payload).forEach(([key, value]) => {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            result[key] = (0, exports.sanitizeInput)(value, nextPath);
        });
        return result;
    }
    return payload;
};
exports.sanitizeInput = sanitizeInput;
const sanitizeRichText = (value, path) => (0, exports.sanitizeHtml)(value, path);
exports.sanitizeRichText = sanitizeRichText;
//# sourceMappingURL=sanitize.js.map