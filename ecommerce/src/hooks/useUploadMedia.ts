import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "@/lib/env";
import { AuthApi } from "@/lib/api/auth";
import type {
  CloudinaryStoredMediaRecord,
  CloudinaryUploadResult,
  CloudinaryUploadType,
  LocalMediaUploadResponse,
  MediaProvider,
  StoredMediaRecord,
} from "@/types/cloudinary-upload";

export interface UploadMediaOptions {
  productId: number;
  type: CloudinaryUploadType;
  alt?: string;
  order?: number;
}

export interface UseUploadMediaResult {
  upload: (file: File, options: UploadMediaOptions) => Promise<StoredMediaRecord>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
  cancel: () => void;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const isImageFile = (file: File) => file.type.startsWith("image/");
const isVideoFile = (file: File) => file.type.startsWith("video/");

const validateFile = (file: File, type: CloudinaryUploadType) => {
  if (type === "image" && !isImageFile(file)) {
    throw new Error("Solo se permiten imágenes para este upload.")
  }
  if (type === "video" && !isVideoFile(file)) {
    throw new Error("Solo se permiten videos para este upload.")
  }

  const maxSize = type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxSize) {
    throw new Error(
      type === "image"
        ? "La imagen supera el límite de 5MB."
        : "El video supera el límite de 20MB.",
    );
  }
};

const buildUploadEndpoint = (cloudName: string, type: CloudinaryUploadType) =>
  `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${type}/upload`;

const buildBackendUploadEndpoint = (path: string) =>
  new URL(path.replace(/^\//, ""), env.authApiBaseUrl.endsWith("/") ? env.authApiBaseUrl : `${env.authApiBaseUrl}/`).toString();

const uploadWithProgress = (
  endpoint: string,
  formData: FormData,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
  withCredentials = false,
) =>
  new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.withCredentials = withCredentials;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress?.(Math.min(100, Math.max(0, progress)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResult);
        } catch {
          reject(new Error("Respuesta inválida desde el servidor de media."));
        }
        return;
      }
      reject(new Error(`Upload failed (${xhr.status})`));
    };

    xhr.onerror = () => {
      reject(new Error("No se pudo completar el upload."));
    };

    xhr.onabort = () => {
      reject(new DOMException("Upload cancelled", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
      } else {
        signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
    }

    xhr.send(formData);
  });

export function useUploadMedia(): UseUploadMediaResult {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<MediaProvider | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const providerRequestRef = useRef<Promise<MediaProvider> | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const config = await AuthApi.getAuthConfig();
        if (active) {
          setProvider(config.media.provider);
        }
      } catch {
        if (active) {
          setProvider("local");
        }
      }
    })();

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const resolveProvider = useCallback(async () => {
    if (provider) {
      return provider;
    }

    if (!providerRequestRef.current) {
      providerRequestRef.current = AuthApi.getAuthConfig()
        .then((config) => config.media.provider ?? "local")
        .catch(() => "local" as MediaProvider);
    }

    const resolved = await providerRequestRef.current;
    setProvider(resolved);
    return resolved;
  }, [provider]);

  const upload = useCallback(
    async (file: File, options: UploadMediaOptions) => {
      validateFile(file, options.type);
      reset();
      setIsUploading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resolvedProvider = await resolveProvider();

        const stored: StoredMediaRecord =
          resolvedProvider === "cloudinary"
            ? await (async () => {
                const signature = await AuthApi.getCloudinaryUploadSignature({
                  productId: options.productId,
                  type: options.type,
                });

                const endpoint = buildUploadEndpoint(signature.cloudName, options.type);
                const formData = new FormData();
                formData.append("file", file);
                formData.append("api_key", signature.apiKey);
                formData.append("timestamp", String(signature.timestamp));
                formData.append("signature", signature.signature);
                formData.append("folder", signature.folder);

                const result = await uploadWithProgress(endpoint, formData, controller.signal, setProgress);
                return {
                  provider: "cloudinary",
                  img: result.public_id,
                  publicId: result.public_id,
                  version: result.version ?? 1,
                  type: result.resource_type ?? options.type,
                  order: options.order ?? 0,
                  alt: options.alt?.trim() || undefined,
                } satisfies CloudinaryStoredMediaRecord;
              })()
            : await (async () => {
                const endpoint = buildBackendUploadEndpoint("/media/upload");
                const formData = new FormData();
                formData.append("file", file);
                formData.append("productId", String(options.productId));
                formData.append("type", options.type);
                formData.append("order", String(options.order ?? 0));
                if (options.alt?.trim()) {
                  formData.append("alt", options.alt.trim());
                }

                const result = await uploadWithProgress(endpoint, formData, controller.signal, setProgress, true);
                const response = result as unknown as LocalMediaUploadResponse;
                return {
                  provider: "local",
                  img: response.img,
                  publicId: response.publicId,
                  version: response.version ?? 1,
                  type: response.type ?? options.type,
                  order: response.order ?? options.order ?? 0,
                  alt: response.alt ?? (options.alt?.trim() || undefined),
                } satisfies StoredMediaRecord;
              })();

        setProgress(100);
        return stored;
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Error al subir el archivo.";
        setError(message);
        throw uploadError;
      } finally {
        setIsUploading(false);
      }
    },
    [resolveProvider, reset],
  );

  return {
    upload,
    isUploading,
    progress,
    error,
    reset,
    cancel,
  };
}
