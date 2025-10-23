/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_STATE_SIGNATURE_KEY?: string
    readonly VITE_RECAPTCHA_SITE_KEY?: string
    readonly VITE_CLIENT_SLUG?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
