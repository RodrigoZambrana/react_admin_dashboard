import { apiSignIn, apiSignOut, apiSignUp } from '@/services/AuthService'
import {
    setUser,
    signInSuccess,
    signOutSuccess,
    setLang,
    useAppSelector,
    useAppDispatch,
} from '@/store'
import appConfig from '@/configs/app.config'
import { REDIRECT_URL_KEY } from '@/constants/app.constant'
import { useNavigate } from 'react-router-dom'
import useQuery from './useQuery'
import type { SignInCredential, SignUpCredential } from '@/@types/auth'

type Status = 'success' | 'failed'

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

function useAuth() {
    const dispatch = useAppDispatch()

    const navigate = useNavigate()

    const query = useQuery()

    const { token, signedIn, expiresAt } = useAppSelector(
        (state) => state.auth.session,
    )

    const signIn = async (
        values: SignInCredential,
    ): Promise<
        | {
              status: Status
              message: string
          }
        | undefined
    > => {
        try {
            const resp = await apiSignIn(values)
            if (resp.data) {
                const { token, expiresAt } = resp.data
                dispatch(
                    signInSuccess({
                        token,
                        expiresAt,
                    }),
                )
                if (resp.data.user) {
                    const displayName =
                        [
                            resp.data.user.name,
                            resp.data.user.lastName,
                        ].filter(Boolean).join(' ') ||
                        resp.data.user.name ||
                        resp.data.user.email ||
                        'User'
                    const userPayload = {
                        avatar: resp.data.user.avatar || '',
                        authority: resp.data.user.authority || ['USER'],
                        email: resp.data.user.email || '',
                        name: resp.data.user.name || '',
                        lastName: resp.data.user.lastName || '',
                        displayName,
                    }
                    dispatch(
                        setUser(userPayload),
                    )
                    const langPreference = normalizeLanguagePreference(resp.data.user.lang)
                    if (langPreference) {
                        dispatch(setLang(langPreference))
                    }
                }
                const redirectUrl = query.get(REDIRECT_URL_KEY)
                navigate(
                    redirectUrl
                        ? redirectUrl
                        : appConfig.authenticatedEntryPath,
                )
                return {
                    status: 'success',
                    message: '',
                }
            }
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        } catch (errors: any) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const signUp = async (values: SignUpCredential) => {
        try {
            const resp = await apiSignUp(values)
            if (resp.data) {
                const { token, expiresAt } = resp.data
                dispatch(
                    signInSuccess({
                        token,
                        expiresAt,
                    }),
                )
                if (resp.data.user) {
                    const displayName =
                        [
                            resp.data.user.name,
                            resp.data.user.lastName,
                        ].filter(Boolean).join(' ') ||
                        resp.data.user.name ||
                        resp.data.user.email ||
                        'User'
                    const userPayload = {
                        avatar: resp.data.user.avatar || '',
                        authority: resp.data.user.authority || ['USER'],
                        email: resp.data.user.email || '',
                        name: resp.data.user.name || '',
                        lastName: resp.data.user.lastName || '',
                        displayName,
                    }
                    dispatch(
                        setUser(userPayload),
                    )
                    const langPreference = normalizeLanguagePreference(resp.data.user.lang)
                    if (langPreference) {
                        dispatch(setLang(langPreference))
                    }
                }
                const redirectUrl = query.get(REDIRECT_URL_KEY)
                navigate(
                    redirectUrl
                        ? redirectUrl
                        : appConfig.authenticatedEntryPath,
                )
                return {
                    status: 'success',
                    message: '',
                }
            }
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        } catch (errors: any) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const handleSignOut = () => {
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

    const signOut = async () => {
        await apiSignOut()
        handleSignOut()
    }

    const expiryTime = (() => {
        if (!expiresAt) {
            return null
        }
        const parsed = Date.parse(expiresAt)
        if (Number.isNaN(parsed)) {
            return null
        }
        return parsed
    })()

    const isExpired =
        expiryTime === null ? Boolean(expiresAt) : expiryTime <= Date.now()

    return {
        authenticated: Boolean(token && signedIn && !isExpired),
        signIn,
        signUp,
        signOut,
    }
}

export default useAuth
