import { useEffect } from 'react'
import ConfigProvider from '@/components/ui/ConfigProvider'
import useDarkMode from '@/utils/hooks/useDarkmode'
import type { CommonProps } from '@/@types/common'
import { themeConfig } from '@/configs/theme.config'
import appConfig from '@/configs/app.config'
import {
    useAppDispatch,
    useAppSelector,
    setUser,
    signOutSuccess,
    signInSuccess,
    setLang,
} from '@/store'
import { fetchThemeConfig } from '@/store/slices/theme/themeSlice'
import { apiGetSession, apiSignOut } from '@/services/AuthService'
import { captureAnalyticsAttributionFromLocation } from '@/services/AnalyticsEventService'
import { useNavigate } from 'react-router-dom'

const normalizeLanguagePreference = (lang?: string | null) => {
    if (!lang) {
        return null
    }
    const lowered = lang.trim().toLowerCase()
    if (lowered.startsWith('es')) {
        return 'es'
    }
    if (lowered.startsWith('en')) {
        return 'en'
    }
    return null
}

const Theme = (props: CommonProps) => {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const theme = useAppSelector((state) => state.theme)
    const locale = useAppSelector((state) => state.locale.currentLang)
    const { signedIn: isSignedIn, token, expiresAt, initialized } = useAppSelector(
        (state) => state.auth.session,
    )

    useEffect(() => {
        if (initialized) {
            return
        }

        let active = true

        const clearLocalAuth = () => {
            dispatch(signOutSuccess())
            dispatch(
                setUser({
                    avatar: '',
                    displayName: '',
                    email: '',
                    authority: [],
                    name: '',
                    lastName: '',
                    capabilityGroups: [],
                    directCapabilities: [],
                    capabilityEnvelope: [],
                    capabilitySource: '',
                    userManagementPolicy: {
                        canAccessUserManagement: false,
                        canManageUserCapabilities: false,
                        allowedUserManagementRoles: [],
                        allowedCapabilityManagementRoles: [],
                        userManagementPolicySource: 'environment',
                        capabilityManagementPolicySource: 'environment',
                    },
                }),
            )
        }

        void apiGetSession()
            .then((resp) => {
                if (!active) {
                    return
                }

                if (resp.data?.token) {
                    dispatch(
                        signInSuccess({
                            token: resp.data.token,
                            expiresAt: resp.data.expiresAt,
                        }),
                    )

                    const displayName =
                        [resp.data.user.name, resp.data.user.lastName]
                            .filter(Boolean)
                            .join(' ') ||
                        resp.data.user.name ||
                        resp.data.user.email ||
                        'User'

                    dispatch(
                        setUser({
                            avatar: resp.data.user.avatar || '',
                            authority: resp.data.user.authority || ['USER'],
                            email: resp.data.user.email || '',
                            name: resp.data.user.name || '',
                            lastName: resp.data.user.lastName || '',
                            capabilityGroups:
                                resp.data.user.capabilityGroups || [],
                            directCapabilities:
                                resp.data.user.directCapabilities || [],
                            capabilityEnvelope:
                                resp.data.user.capabilityEnvelope || [],
                            capabilitySource:
                                resp.data.user.capabilitySource || '',
                            userManagementPolicy:
                                resp.data.user.userManagementPolicy || undefined,
                            displayName,
                        }),
                    )

                    const langPreference = normalizeLanguagePreference(
                        resp.data.user.lang,
                    )
                    if (langPreference) {
                        dispatch(setLang(langPreference))
                    }
                    return
                }

                clearLocalAuth()
            })
            .catch(() => {
                if (active) {
                    clearLocalAuth()
                }
            })

        return () => {
            active = false
        }
    }, [dispatch, initialized])

    useEffect(() => {
        if (!initialized || !isSignedIn) {
            return
        }

        if (token) {
            dispatch(fetchThemeConfig())
        }

        if (typeof window === 'undefined') {
            return
        }

        if (!token || !expiresAt) {
            return
        }

        const parsedExpiry = Date.parse(expiresAt)

        const signOutLocally = () => {
            dispatch(signOutSuccess())
            dispatch(
                setUser({
                    avatar: '',
                    displayName: '',
                    email: '',
                    authority: [],
                    capabilityGroups: [],
                    directCapabilities: [],
                    capabilityEnvelope: [],
                    capabilitySource: '',
                    userManagementPolicy: {
                        canAccessUserManagement: false,
                        canManageUserCapabilities: false,
                        allowedUserManagementRoles: [],
                        allowedCapabilityManagementRoles: [],
                        userManagementPolicySource: 'environment',
                        capabilityManagementPolicySource: 'environment',
                    },
                }),
            )
            navigate(appConfig.unAuthenticatedEntryPath)
        }

        const signOutAndNotify = () => {
            void apiSignOut().catch(() => undefined)
            signOutLocally()
        }

        if (Number.isNaN(parsedExpiry)) {
            signOutAndNotify()
            return
        }

        const remaining = parsedExpiry - Date.now()

        if (remaining <= 0) {
            signOutAndNotify()
            return
        }

        const timer = window.setTimeout(() => {
            signOutAndNotify()
        }, remaining)

        return () => window.clearTimeout(timer)
    }, [dispatch, navigate, initialized, isSignedIn, token, expiresAt])

    useDarkMode()

    useEffect(() => {
        captureAnalyticsAttributionFromLocation()
    }, [])

    const currentTheme = {
        ...themeConfig,
        ...theme,
        ...{ locale },
    }

    return (
        <ConfigProvider value={currentTheme}>{props.children}</ConfigProvider>
    )
}

export default Theme
