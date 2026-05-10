import { env } from "@/lib/env";
import { getImageUrl, getVideoUrl, isCloudinaryUrl } from "@/lib/cloudinary";
import type { StoredMediaRecord } from "@/types/cloudinary-upload";

const normalizeBase = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);

const getOrigin = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const normalizeSameOriginUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const publicOrigins = [
      env.publicSiteOrigin,
      getOrigin(env.publicMediaBaseUrl),
      getOrigin(env.publicApiBaseUrl),
      getOrigin(env.publicAuthApiBaseUrl),
    ].filter((origin): origin is string => Boolean(origin));

    if (publicOrigins.includes(url.origin)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
};

const resolveMediaBaseUrl = () => normalizeBase(env.publicMediaBaseUrl || "http://localhost:8080/media");

const resolveUploadsBaseUrl = () => {
  try {
    const mediaBase = new URL(env.publicMediaBaseUrl || "http://localhost:8080/media");
    mediaBase.pathname = mediaBase.pathname.replace(/\/media\/?$/i, "/uploads");
    return normalizeBase(mediaBase.toString());
  } catch {
    return normalizeBase(`${env.publicSiteOrigin || "http://localhost:8080"}/uploads`);
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

  if (/^data:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeSameOriginUrl(trimmed);
  }

  const normalized = normalizePublicId(trimmed);
  if (!normalized) {
    return "";
  }

  if (/^cms\/legacy-assets\//i.test(normalized)) {
    return normalizeSameOriginUrl(`${resolveUploadsBaseUrl()}/${normalized}`);
  }

  return normalizeSameOriginUrl(`${resolveMediaBaseUrl()}/${normalized}`);
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
