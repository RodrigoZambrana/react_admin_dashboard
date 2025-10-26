export declare const sanitizeHtml: (value: string, path?: string) => string;
type Sanitizable = string | number | boolean | null | undefined | Buffer | Date | Record<string, unknown> | Sanitizable[];
export declare const sanitizeInput: <T extends Sanitizable>(payload: T, currentPath?: string) => T;
export declare const sanitizeRichText: (value: string, path?: string) => string;
export {};
