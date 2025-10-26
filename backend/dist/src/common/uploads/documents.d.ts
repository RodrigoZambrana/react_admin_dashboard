type MultipartFile = import('@fastify/multipart').MultipartFile;
type PersistOptions = {
    documentType: 'BUDGET' | 'ORDER';
    previousPath?: string | null;
};
type PersistResult = {
    path: string;
    mime: string;
    size: number;
    name: string;
};
export declare const isSalesDocumentLocalPath: (value?: string | null) => boolean;
export declare const resolveSalesDocumentLocalPath: (value?: string | null) => string | null;
export declare const persistSalesDocumentFile: (file: MultipartFile, options: PersistOptions) => Promise<PersistResult>;
export declare const deleteSalesDocumentFile: (value?: string | null) => Promise<void>;
export {};
