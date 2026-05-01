export type CloudinaryUploadType = "image" | "video";
export type MediaProvider = "local" | "cloudinary";

export interface CloudinaryUploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: CloudinaryUploadType;
}

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  resource_type: CloudinaryUploadType;
  type?: string;
  width?: number;
  height?: number;
  format?: string;
  secure_url?: string;
  bytes?: number;
  duration?: number;
  original_filename?: string;
}

export interface MediaProviderConfig {
  provider: MediaProvider;
}

export interface LocalStoredMediaRecord {
  provider: "local";
  img: string;
  publicId: string;
  version: number;
  type: CloudinaryUploadType;
  order: number;
  alt?: string;
}

export interface CloudinaryStoredMediaRecord {
  provider: "cloudinary";
  img: string;
  publicId: string;
  version: number;
  type: CloudinaryUploadType;
  order: number;
  alt?: string;
}

export type StoredMediaRecord = LocalStoredMediaRecord | CloudinaryStoredMediaRecord;

export interface LocalMediaUploadResponse {
  provider: "local";
  img: string;
  publicId: string;
  version: number;
  type: CloudinaryUploadType;
  order: number;
  alt?: string;
}
