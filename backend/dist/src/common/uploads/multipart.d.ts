import type { FastifyRequest } from 'fastify';
export type ParsedMultipartResult = {
    fields: Record<string, string>;
    file?: MultipartFile;
};
type MultipartFile = import('@fastify/multipart').MultipartFile;
export declare const parseSingleFileMultipart: (req: FastifyRequest) => Promise<ParsedMultipartResult>;
export {};
