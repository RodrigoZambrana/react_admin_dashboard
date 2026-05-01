const CLOUDINARY_DEFAULT_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;

export type CloudinaryMediaType = "image" | "video";

export const IMAGE_SIZES = {
  thumbnail: 300,
  card: 500,
  detail: 800,
  zoom: 1200,
} as const;

export type CloudinaryImageSize = keyof typeof IMAGE_SIZES;

export type CloudinaryImageUrlOptions = {
  version: number;
  size?: CloudinaryImageSize;
  quality?: "auto" | "best" | "eco" | "good" | "low" | string;
  format?: "auto" | "avif" | "webp" | "jpg" | "png" | string;
};

export type CloudinaryVideoUrlOptions = {
  version: number;
  quality?: "auto" | "best" | "eco" | "good" | "low" | string;
  format?: "mp4" | "auto" | string;
};

export type CloudinaryStoredMedia = {
  public_id: string;
  version: number;
  type: CloudinaryMediaType;
  order: number;
  alt?: string;
};

const DEFAULT_CLOUD_NAME = "demo";
const DEFAULT_VERSION = 1;
const CLOUDINARY_URL_LOG_SAMPLE_RATE = Number(
  process.env.NEXT_PUBLIC_CLOUDINARY_URL_LOG_SAMPLE_RATE ??
    process.env.CLOUDINARY_URL_LOG_SAMPLE_RATE ??
    "0",
);

const normalizePublicId = (publicId: string) =>
  publicId
    .trim()
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const normalizeCloudinaryValue = (value: string | number | undefined, fallback: string) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
};

const resolveCloudName = () => CLOUDINARY_DEFAULT_CLOUD_NAME ?? DEFAULT_CLOUD_NAME;

const normalizeVersion = (version: number | undefined | null) =>
  Number.isFinite(version ?? NaN) ? Math.max(DEFAULT_VERSION, Math.trunc(version ?? DEFAULT_VERSION)) : DEFAULT_VERSION;

const resolveSize = (size: CloudinaryImageSize | undefined) =>
  IMAGE_SIZES[size ?? "detail"];

const buildTransformSegment = (options: {
  width?: number;
  quality?: string;
  format?: string;
}) => {
  const transformParts = [] as string[];
  if (Number.isFinite(options.width ?? NaN)) {
    transformParts.push(`w_${Math.max(1, Math.round(options.width ?? 1))}`);
  }
  transformParts.push(`f_${normalizeCloudinaryValue(options.format, "auto")}`);
  transformParts.push(`q_${normalizeCloudinaryValue(options.quality, "auto")}`);
  return transformParts.join(",");
};

const maybeLogGeneratedUrl = (type: CloudinaryMediaType, publicId: string, url: string) => {
  if (CLOUDINARY_URL_LOG_SAMPLE_RATE <= 0) {
    return;
  }
  if (Math.random() > CLOUDINARY_URL_LOG_SAMPLE_RATE) {
    return;
  }
  // Prevent hardcoded Cloudinary URLs in the app. This sample log helps catch churny URL generation.
  console.debug(`[cloudinary] ${type} url generated for ${publicId}: ${url}`)
};

const buildCloudinaryUrl = (resourceType: CloudinaryMediaType, publicId: string, options: {
  version: number;
  quality?: string;
  format?: string;
  width?: number;
}) => {
  const cloudName = resolveCloudName();
  const resourcePath = resourceType === "video" ? "video/upload" : "image/upload";
  const transform = buildTransformSegment(options);
  const normalizedPublicId = normalizePublicId(publicId);
  const url = `https://res.cloudinary.com/${cloudName}/${resourcePath}/v${normalizeVersion(options.version)}/${transform}/${normalizedPublicId}`;
  maybeLogGeneratedUrl(resourceType, publicId, url);
  return url;
};

export const getImageUrl = (
  public_id: string,
  options: CloudinaryImageUrlOptions,
) => buildCloudinaryUrl("image", public_id, {
  version: options.version,
  width: resolveSize(options.size),
  quality: options.quality,
  format: options.format,
});

export const getVideoUrl = (
  public_id: string,
  options: CloudinaryVideoUrlOptions,
) => buildCloudinaryUrl("video", public_id, {
  version: options.version,
  quality: options.quality,
  format: options.format ?? "mp4",
});

export const isCloudinaryUrl = (value?: string | null) =>
  Boolean(value && /^https:\/\/res\.cloudinary\.com\//i.test(value.trim()));
