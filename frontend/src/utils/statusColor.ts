export type StatusColorClasses = {
    token: string
    dotClass: string
    textClass: string
    customColor?: string
}

const resolve = (token: string): StatusColorClasses => ({
    token,
    dotClass: token ? `bg-${token}` : '',
    textClass: token ? `text-${token}` : '',
})

export const deriveStatusColorClasses = (value?: string): StatusColorClasses => {
    if (!value) {
        return resolve('gray-400')
    }

    const normalized = value.trim().toLowerCase()

    if (!normalized) {
        return resolve('gray-400')
    }

    if (normalized.startsWith('#') || normalized.startsWith('rgb')) {
        return {
            token: normalized,
            dotClass: '',
            textClass: '',
            customColor: value,
        }
    }

    if (/^[a-z]+-\d{3}$/i.test(normalized)) {
        return resolve(normalized)
    }

    if (normalized.includes('emerald') || normalized.includes('green') || normalized.includes('success')) {
        return resolve('emerald-500')
    }

    if (normalized.includes('blue') || normalized.includes('primary') || normalized.includes('info')) {
        return resolve('blue-500')
    }

    if (normalized.includes('orange') || normalized.includes('yellow') || normalized.includes('warning')) {
        return resolve('orange-500')
    }

    if (normalized.includes('red') || normalized.includes('danger') || normalized.includes('error') || normalized.includes('cancel')) {
        return resolve('red-500')
    }

    if (normalized.includes('gray') || normalized.includes('secondary') || normalized.includes('neutral')) {
        return resolve('gray-500')
    }

    return resolve('gray-400')
}
