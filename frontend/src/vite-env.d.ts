/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_STATE_SIGNATURE_KEY?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
