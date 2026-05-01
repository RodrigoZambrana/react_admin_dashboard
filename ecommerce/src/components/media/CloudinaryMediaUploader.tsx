"use client";

import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadMedia } from "@/hooks/useUploadMedia";
import type { CloudinaryUploadType, StoredMediaRecord } from "@/types/cloudinary-upload";

type Props = {
  productId: number;
  type: CloudinaryUploadType;
  alt?: string;
  order?: number;
  onUploaded?: (media: StoredMediaRecord) => void;
};

const ACCEPTED_FILES = {
  image: { "image/*": [] as string[] },
  video: { "video/*": [] as string[] },
};

export default function CloudinaryMediaUploader({
  productId,
  type,
  alt,
  order = 0,
  onUploaded,
}: Props) {
  const { upload, isUploading, progress, error } = useUploadMedia();
  const [lastUploaded, setLastUploaded] = useState<StoredMediaRecord | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const accept = useMemo(() => ACCEPTED_FILES[type], [type]);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
      setLocalError(null);
      const media = await upload(file, { productId, type, alt, order });
      setLastUploaded(media);
      onUploaded?.(media);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple: false,
    maxFiles: 1,
    disabled: isUploading,
    onDropAccepted: handleFiles,
    onDropRejected: () => {
      setLocalError(type === "image" ? "Archivo inválido para imagen." : "Archivo inválido para video.");
    },
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: "1px dashed rgba(15, 23, 42, 0.2)",
        borderRadius: 16,
        padding: 20,
        background: isDragActive ? "rgba(15, 23, 42, 0.04)" : "rgba(255,255,255,0.9)",
        cursor: isUploading ? "progress" : "pointer",
        display: "grid",
        gap: 12,
      }}
    >
      <input {...getInputProps()} />
      <strong>{type === "image" ? "Subir imagen" : "Subir video"}</strong>
      <span style={{ color: "#475569" }}>
        {isUploading ? "Subiendo media..." : "Arrastrá un archivo o hacé click para elegirlo."}
      </span>
      <div
        style={{
          height: 8,
          background: "#e2e8f0",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#0f172a",
            transition: "width 150ms ease",
          }}
        />
      </div>
      {localError || error ? <span style={{ color: "#b91c1c" }}>{localError ?? error}</span> : null}
      {lastUploaded ? (
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(lastUploaded, null, 2)}
        </pre>
      ) : null}
      <small style={{ color: "#64748b" }}>
        Imágenes hasta 5MB y videos hasta 20MB. El backend usa el provider activo sin guardar archivos binarios.
      </small>
    </div>
  );
}
