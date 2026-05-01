import { env } from "@/lib/env";
import { getImageUrl, getVideoUrl } from "@/lib/cloudinary";
import type { StoredMediaRecord } from "@/types/cloudinary-upload";

const normalizeBase = (value: string) => (value.endsWith("/") ? value.slice(0, -1) : value);

const resolveMediaBaseUrl = () => normalizeBase(env.publicMediaBaseUrl || "http://localhost:3000/media");

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

  return `${resolveMediaBaseUrl()}/${normalized}`;
};

export const resolveStoredMediaUrl = (media: StoredMediaRecord) => {
  if (media.provider === "cloudinary") {
    return media.type === "video"
      ? getVideoUrl(media.publicId, { version: media.version })
      : getImageUrl(media.publicId, { version: media.version, size: "detail" });
  }

  return getMediaUrl(media.publicId ?? media.img ?? "");
};
