export const DEFAULT_CLIENT_SLUG = "core";

export const KNOWN_CLIENT_SLUGS = ["core", "retail", "urucortinas"] as const;

export type KnownClientSlug = (typeof KNOWN_CLIENT_SLUGS)[number];
