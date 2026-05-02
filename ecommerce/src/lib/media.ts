import { env } from "@/lib/env";
import { getImageUrl, getVideoUrl, isCloudinaryUrl } from "@/lib/cloudinary";
import type { StoredMediaRecord } from "@/types/cloudinary-upload";

const normalizeBase = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);

const resolveMediaBaseUrl = () => normalizeBase(env.publicMediaBaseUrl || "http://localhost:3000/media");

const resolveUploadsBaseUrl = () => {
  try {
    const mediaBase = new URL(env.publicMediaBaseUrl || "http://localhost:3000/media");
    mediaBase.pathname = mediaBase.pathname.replace(/\/media\/?$/i, "/uploads");
    return normalizeBase(mediaBase.toString());
  } catch {
    return normalizeBase(`${env.publicSiteOrigin || "http://localhost:3000"}/uploads`);
  }
};

const normalizePublicId = (value: string) =>
  value
    .trim()
    .replace(/^\/+/, "")
    .replace(/^media\/+/i, "")
    .replace(/^uploads\/+/i, "");

export const getMediaUrl = (publicId: string) => {
  const trimmed = publicId?.trim();
  if (!trimmed) {
    return "";
  }

  if (/^(https?:|data:)/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = normalizePublicId(trimmed);
  if (!normalized) {
    return "";
  }

  if (/^cms\/legacy-assets\//i.test(normalized)) {
    return `${resolveUploadsBaseUrl()}/${normalized}`;
  }

  return `${resolveMediaBaseUrl()}/${normalized}`;
};

const extractCloudinaryPublicId = (value: string) => {
  if (!isCloudinaryUrl(value)) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const uploadMarker = "/upload/";
    const uploadIndex = parsed.pathname.indexOf(uploadMarker);
    if (uploadIndex < 0) {
      return null;
    }

    const tail = parsed.pathname
      .slice(uploadIndex + uploadMarker.length)
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (!tail.length) {
      return null;
    }

    const versionIndex = tail.findIndex((segment) => /^v\d+$/i.test(segment));
    const publicIdSegments = versionIndex >= 0 ? tail.slice(versionIndex + 1) : tail;
    if (!publicIdSegments.length) {
      return null;
    }

    return publicIdSegments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return null;
  }
};

const isCloudinaryMediaProvider = () => env.publicMediaProvider === "cloudinary";

const resolveLocalAssetUrl = (value?: string | null, publicId?: string | null) => {
  const trimmedUrl = value?.trim() ?? "";
  if (trimmedUrl && !isCloudinaryUrl(trimmedUrl)) {
    return getMediaUrl(trimmedUrl);
  }

  const trimmedPublicId = publicId?.trim() ?? "";
  if (trimmedPublicId) {
    return getMediaUrl(trimmedPublicId);
  }

  const cloudinaryPublicId = trimmedUrl ? extractCloudinaryPublicId(trimmedUrl) : null;
  if (cloudinaryPublicId) {
    return getMediaUrl(cloudinaryPublicId);
  }

  return "";
};

export const resolveMediaAssetUrl = (asset: {
  url?: string | null;
  publicId?: string | null;
  version?: number | null;
  type?: "image" | "video" | null;
}) => {
  if (!asset) {
    return "";
  }

  if (!isCloudinaryMediaProvider()) {
    return resolveLocalAssetUrl(asset.url ?? null, asset.publicId ?? null);
  }

  if (asset.publicId) {
    return asset.type === "video"
      ? getVideoUrl(asset.publicId, { version: asset.version ?? 1, format: "mp4" })
      : getImageUrl(asset.publicId, { version: asset.version ?? 1, size: "detail" });
  }

  if (asset.url && isCloudinaryUrl(asset.url)) {
    return asset.url;
  }

  return resolveLocalAssetUrl(asset.url ?? null, asset.publicId ?? null);
};

export const resolveStoredMediaUrl = (media: StoredMediaRecord) => {
  if (media.provider === "cloudinary" && isCloudinaryMediaProvider()) {
    return media.type === "video"
      ? getVideoUrl(media.publicId, { version: media.version })
      : getImageUrl(media.publicId, { version: media.version, size: "detail" });
  }

  return resolveLocalAssetUrl(media.img ?? null, media.publicId ?? null);
};
