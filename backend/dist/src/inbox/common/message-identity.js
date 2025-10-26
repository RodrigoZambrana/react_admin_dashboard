"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FOLDER = void 0;
exports.normalizeFolder = normalizeFolder;
exports.deriveMessageUid = deriveMessageUid;
exports.hashMessageBody = hashMessageBody;
const crypto_1 = require("crypto");
exports.DEFAULT_FOLDER = 'INBOX';
function normalizeFolder(folder) {
    return (folder || exports.DEFAULT_FOLDER).trim().toLowerCase();
}
function deriveMessageUid(input) {
    const provider = (input.provider || 'generic').trim().toLowerCase();
    const folder = normalizeFolder(input.folder);
    const base = deriveBaseIdentifier(input);
    return `${provider}:${folder}:${base}`;
}
function deriveBaseIdentifier(input) {
    const normalized = normalizeMessageId(input.messageId);
    if (normalized) {
        return `mid:${normalized}`;
    }
    if (input.gmailId) {
        return `gmail:${input.gmailId}`;
    }
    const headerId = normalizeMessageId(input.headers?.['message-id']);
    if (headerId) {
        return `hdr:${headerId}`;
    }
    if (input.remoteId) {
        return `remote:${String(input.remoteId).trim()}`;
    }
    const hashSource = JSON.stringify({
        provider: input.provider,
        folder: input.folder,
        bodyHash: hashMessageBody(input),
    });
    return `hash:${sha1(hashSource)}`;
}
function normalizeMessageId(messageId) {
    if (!messageId) {
        return null;
    }
    const trimmed = messageId.trim().toLowerCase();
    if (!trimmed) {
        return null;
    }
    return trimmed.replace(/^<|>$/g, '');
}
function hashMessageBody(input) {
    const html = (input.bodyHtml || '').trim();
    const text = (input.bodyText || '').trim();
    if (!html && !text) {
        return null;
    }
    return sha1(`${html}::${text}`);
}
function sha1(value) {
    return (0, crypto_1.createHash)('sha1').update(value).digest('hex');
}
//# sourceMappingURL=message-identity.js.map