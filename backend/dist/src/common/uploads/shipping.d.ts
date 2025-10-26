type MultipartFile = import('@fastify/multipart').MultipartFile;
export declare const normalizeShippingLogoPath: (value?: string | null) => string | null;
export declare const persistShippingLogo: (file: MultipartFile, previous?: string | null) => Promise<string>;
export declare const deleteShippingLogo: (value?: string | null) => Promise<void>;
export {};
