import { useEffect, useState } from 'react'
import classNames from 'classnames'
import { Link } from 'react-router-dom'
import { APP_NAME } from '@/constants/app.constant'
import { appPath, publicAssetPath } from '@/constants/route.constant'
import { apiGetCompanyProfile } from '@/services/SettingsService'
import store from '@/store'
import type { CommonProps } from '@/@types/common'

interface LogoProps extends CommonProps {
    type?: 'full' | 'streamline'
    mode?: 'light' | 'dark'
    imgClass?: string
    logoWidth?: number | string
    customSrc?: string | null
}

const COMPANY_LOGO_EVENT = 'app:company-logo-changed'

let cachedCompanyLogo: string | null | undefined
let pendingLogoRequest: Promise<string | null> | null = null

const resolveDefaultLogo = (mode: 'light' | 'dark', type: 'full' | 'streamline') =>
    publicAssetPath('img', 'logo', `logo-${mode}-${type}.png`)

const normalizeLogoSrc = (value: string): string => {
    const trimmed = value.trim()

    if (!trimmed.length) {
        return trimmed
    }

    if (/^(?:https?:)?\/\//u.test(trimmed) || trimmed.startsWith('data:')) {
        return trimmed
    }

    if (trimmed.startsWith('/img/') || trimmed.startsWith('img/')) {
        return publicAssetPath(trimmed)
    }

    return trimmed
}

const normalizeLogoValue = (value: string | null | undefined): string | null | undefined => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length ? trimmed : null
    }
    if (value === null) {
        return null
    }
    return undefined
}

const dispatchLogoEvent = (value: string | null | undefined) => {
    if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
        return
    }
    window.dispatchEvent(new CustomEvent(COMPANY_LOGO_EVENT, { detail: value }))
}

export const updateCompanyLogoCache = (value: string | null | undefined) => {
    cachedCompanyLogo = normalizeLogoValue(value)
    dispatchLogoEvent(cachedCompanyLogo)
}

const fetchCompanyLogo = async (): Promise<string | null> => {
    if (cachedCompanyLogo !== undefined) {
        return cachedCompanyLogo
    }
    if (pendingLogoRequest) {
        return pendingLogoRequest
    }
    const token =
        store.getState()?.auth?.session?.token ??
        null
    if (!token) {
        cachedCompanyLogo = null
        dispatchLogoEvent(cachedCompanyLogo)
        return null
    }
    pendingLogoRequest = apiGetCompanyProfile<{ logo?: string | null }>()
        .then((response) => {
            const logo = normalizeLogoValue(response.data?.logo)
            cachedCompanyLogo = logo ?? null
            dispatchLogoEvent(cachedCompanyLogo)
            return cachedCompanyLogo
        })
        .catch(() => {
            cachedCompanyLogo = null
            dispatchLogoEvent(cachedCompanyLogo)
            return null
        })
        .finally(() => {
            pendingLogoRequest = null
        })
    return pendingLogoRequest
}

const Logo = (props: LogoProps) => {
    const {
        type = 'full',
        mode = 'light',
        className,
        imgClass,
        style,
        logoWidth = 'auto',
        customSrc,
    } = props

    const [logoSrc, setLogoSrc] = useState<string | null | undefined>(
        normalizeLogoValue(customSrc) ?? cachedCompanyLogo,
    )

    useEffect(() => {
        const normalizedCustom = normalizeLogoValue(customSrc)
        if (customSrc !== undefined) {
            updateCompanyLogoCache(normalizedCustom)
            setLogoSrc(normalizedCustom)
            return
        }

        let cancelled = false

        if (cachedCompanyLogo !== undefined) {
            setLogoSrc(cachedCompanyLogo)
        } else {
            fetchCompanyLogo().then((logo) => {
                if (!cancelled) {
                    setLogoSrc(logo)
                }
            })
        }

        return () => {
            cancelled = true
        }
    }, [customSrc])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined
        }

        const handler = (event: Event) => {
            if (customSrc !== undefined) {
                return
            }
            const detail = (event as CustomEvent<string | null | undefined>).detail
            setLogoSrc(normalizeLogoValue(detail))
        }

        window.addEventListener(COMPANY_LOGO_EVENT, handler as EventListener)
        return () => {
            window.removeEventListener(COMPANY_LOGO_EVENT, handler as EventListener)
        }
    }, [customSrc])

    const resolvedSrc =
        logoSrc && typeof logoSrc === 'string' && logoSrc.trim().length
            ? normalizeLogoSrc(logoSrc)
            : resolveDefaultLogo(mode, type)

    const combinedImgClass = classNames('max-h-full w-auto object-contain', imgClass)

    return (
        <Link to={appPath()}>
            <div
                className={classNames('logo flex items-center', className)}
                style={{
                    ...style,
                    ...{ width: logoWidth },
                }}
            >
                <img className={combinedImgClass} src={resolvedSrc} alt={`${APP_NAME} logo`} />
            </div>
        </Link>
    )
}

export default Logo
