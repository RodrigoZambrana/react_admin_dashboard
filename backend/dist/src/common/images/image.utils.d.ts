export type SupportedMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
export declare const SUPPORTED_IMAGE_MIME_TYPES: SupportedMimeType[];
export declare const ensureNodeBuffer: (value: Buffer | Uint8Array | null | undefined) => Buffer | null;
export declare const detectImageMimeType: (buffer: Buffer) => SupportedMimeType | null;
export declare const buildImageDataUrl: (buffer: Buffer) => string | null;
