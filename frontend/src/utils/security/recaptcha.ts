const SCRIPT_ID = 'recaptcha-enterprise-script'
let loadPromise: Promise<void> | null = null

function ensureRecaptchaLoaded(siteKey: string): Promise<void> {
    if (typeof window === 'undefined') {
        return Promise.resolve()
    }

    if (window.grecaptcha?.enterprise) {
        return Promise.resolve()
    }

    if (loadPromise) {
        return loadPromise
    }

    loadPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById(SCRIPT_ID)
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true })
            existingScript.addEventListener(
                'error',
                () => reject(new Error('Unable to load reCAPTCHA script.')),
                { once: true },
            )
            return
        }

        const script = document.createElement('script')
        script.id = SCRIPT_ID
        script.async = true
        script.src = `https://www.google.com/recaptcha/enterprise.js?render=${siteKey}`
        script.onload = () => resolve()
        script.onerror = () => {
            script.remove()
            reject(new Error('Unable to load reCAPTCHA script.'))
        }
        document.head.appendChild(script)
    }).finally(() => {
        loadPromise = null
    })

    return loadPromise
}

export async function executeRecaptchaAction(
    siteKey: string,
    action: string,
): Promise<string> {
    await ensureRecaptchaLoaded(siteKey)

    const enterprise = window.grecaptcha?.enterprise
    if (!enterprise) {
        throw new Error('reCAPTCHA is not available in this environment.')
    }

    await new Promise<void>((resolve) => enterprise.ready(resolve))
    return enterprise.execute(siteKey, { action })
}
