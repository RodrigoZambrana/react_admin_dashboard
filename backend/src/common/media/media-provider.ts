import { resolveOptionalEnv } from '../config/runtime-env'

export type MediaProvider = 'local' | 'cloudinary'

export const DEFAULT_MEDIA_PROVIDER: MediaProvider = 'local'

export const resolveMediaProvider = (): MediaProvider => {
  const configured = resolveOptionalEnv('MEDIA_PROVIDER')
  if (!configured) {
    return DEFAULT_MEDIA_PROVIDER
  }

  return configured.trim().toLowerCase() === 'cloudinary'
    ? 'cloudinary'
    : DEFAULT_MEDIA_PROVIDER
}

export const isCloudinaryMediaProvider = () => resolveMediaProvider() === 'cloudinary'
