"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSalesDocumentFile = exports.persistSalesDocumentFile = exports.resolveSalesDocumentLocalPath = exports.isSalesDocumentLocalPath = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const ALLOWED_DOCUMENT_MIME = new Set(['application/pdf']);
const UPLOADS_ROOT = (0, path_1.join)(process.cwd(), 'uploads');
const DOCUMENTS_ROOT = (0, path_1.join)(UPLOADS_ROOT, 'documents');
const SUBDIRECTORY = {
    BUDGET: 'budgets',
    ORDER: 'orders',
};
const isLocalUploadPath = (value) => Boolean(value && value.startsWith('/uploads/'));
const resolveLocalUploadPath = (value) => {
    const relative = value.replace(/^\/uploads\//, '');
    return (0, path_1.join)(UPLOADS_ROOT, relative);
};
const isSalesDocumentLocalPath = (value) => isLocalUploadPath(value);
exports.isSalesDocumentLocalPath = isSalesDocumentLocalPath;
const resolveSalesDocumentLocalPath = (value) => {
    if (!value || !isLocalUploadPath(value)) {
        return null;
    }
    return resolveLocalUploadPath(value);
};
exports.resolveSalesDocumentLocalPath = resolveSalesDocumentLocalPath;
const collectStreamBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
};
const persistSalesDocumentFile = async (file, options) => {
    if (!ALLOWED_DOCUMENT_MIME.has(file.mimetype)) {
        throw new common_1.BadRequestException({
            message: 'validation.fieldInvalid',
        });
    }
    const original = file.filename || file.originalname || 'document.pdf';
    const ext = (0, path_1.extname)(original) || '.pdf';
    const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
    const fileName = `${(0, crypto_1.randomUUID)()}${safeExt.toLowerCase()}`;
    const subDir = SUBDIRECTORY[options.documentType];
    const targetDir = (0, path_1.join)(DOCUMENTS_ROOT, subDir);
    await (0, promises_1.mkdir)(targetDir, { recursive: true });
    const buffer = typeof file.toBuffer === 'function'
        ? await file.toBuffer()
        : await collectStreamBuffer(file.file);
    await (0, promises_1.writeFile)((0, path_1.join)(targetDir, fileName), buffer);
    if (options.previousPath && isLocalUploadPath(options.previousPath)) {
        try {
            await (0, promises_1.unlink)(resolveLocalUploadPath(options.previousPath));
        }
        catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    return {
        path: `/uploads/documents/${subDir}/${fileName}`,
        mime: file.mimetype,
        size: buffer.length,
        name: original,
    };
};
exports.persistSalesDocumentFile = persistSalesDocumentFile;
const deleteSalesDocumentFile = async (value) => {
    if (!value || !isLocalUploadPath(value)) {
        return;
    }
    try {
        await (0, promises_1.unlink)(resolveLocalUploadPath(value));
    }
    catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
};
exports.deleteSalesDocumentFile = deleteSalesDocumentFile;
//# sourceMappingURL=documents.js.map