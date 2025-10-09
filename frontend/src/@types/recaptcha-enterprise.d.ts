interface GrecaptchaEnterprise {
    ready(callback: () => void): void
    execute(siteKey: string, options: { action: string }): Promise<string>
}

interface Grecaptcha {
    enterprise?: GrecaptchaEnterprise
}

declare global {
    interface Window {
        grecaptcha?: Grecaptcha
    }
}

export {}
