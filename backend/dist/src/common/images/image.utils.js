"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildImageDataUrl = exports.detectImageMimeType = exports.ensureNodeBuffer = exports.SUPPORTED_IMAGE_MIME_TYPES = void 0;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_SIGNATURE = Buffer.from('GIF87a', 'ascii');
const GIF89A_SIGNATURE = Buffer.from('GIF89a', 'ascii');
const WEBP_RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii');
const WEBP_WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii');
exports.SUPPORTED_IMAGE_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];
const ensureNodeBuffer = (value) => {
    if (!value) {
        return null;
    }
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
};
exports.ensureNodeBuffer = ensureNodeBuffer;
const detectImageMimeType = (buffer) => {
    if (!buffer || buffer.length < 4) {
        return null;
    }
    if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        return 'image/png';
    }
    if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
        return 'image/jpeg';
    }
    if (buffer.subarray(0, GIF87A_SIGNATURE.length).equals(GIF87A_SIGNATURE) ||
        buffer.subarray(0, GIF89A_SIGNATURE.length).equals(GIF89A_SIGNATURE)) {
        return 'image/gif';
    }
    if (buffer.length >= 12 &&
        buffer.subarray(0, WEBP_RIFF_SIGNATURE.length).equals(WEBP_RIFF_SIGNATURE) &&
        buffer.subarray(8, 12).equals(WEBP_WEBP_SIGNATURE)) {
        return 'image/webp';
    }
    return null;
};
exports.detectImageMimeType = detectImageMimeType;
const buildImageDataUrl = (buffer) => {
    const mimeType = (0, exports.detectImageMimeType)(buffer);
    if (!mimeType) {
        return null;
    }
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
};
exports.buildImageDataUrl = buildImageDataUrl;
//# sourceMappingURL=image.utils.js.map