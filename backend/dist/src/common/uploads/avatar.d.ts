import type { FastifyRequest } from 'fastify';
type MultipartFile = import('@fastify/multipart').MultipartFile;
export declare const persistAvatarFile: (file: MultipartFile, previous?: string | null) => Promise<string>;
export declare const normalizeAvatarPath: (value?: string | null) => string | null;
export declare const resolveAvatarPublicUrl: (req: FastifyRequest, value?: string | null) => string;
export {};
