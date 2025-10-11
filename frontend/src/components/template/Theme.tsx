import { useEffect } from 'react'
import ConfigProvider from '@/components/ui/ConfigProvider'
import useDarkMode from '@/utils/hooks/useDarkmode'
import type { CommonProps } from '@/@types/common'
import { themeConfig } from '@/configs/theme.config'
import appConfig from '@/configs/app.config'
import { useAppDispatch, useAppSelector, setUser, signOutSuccess } from '@/store'
import { fetchThemeConfig } from '@/store/slices/theme/themeSlice'
import { apiSignOut } from '@/services/AuthService'
import { useNavigate } from 'react-router-dom'

const Theme = (props: CommonProps) => {
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const theme = useAppSelector((state) => state.theme)
    const locale = useAppSelector((state) => state.locale.currentLang)
    const { signedIn: isSignedIn, token, expiresAt } = useAppSelector(
        (state) => state.auth.session,
    )

    useEffect(() => {
        if (!isSignedIn) {
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
    }, [dispatch, navigate, isSignedIn, token, expiresAt])

    useDarkMode()

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
