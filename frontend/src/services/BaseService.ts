import axios from 'axios'
import appConfig from '@/configs/app.config'
import { TOKEN_TYPE, REQUEST_HEADER_AUTH_KEY } from '@/constants/api.constant'
import store, { signOutSuccess } from '../store'
import {
    sanitizePayload,
    sanitizeFormData,
    UnsafeInputError,
} from '@/utils/security/inputGuards'

const unauthorizedCode = [401]

const BaseService = axios.create({
    timeout: 60000,
    baseURL: appConfig.apiPrefix,
    withCredentials: true,
})

BaseService.interceptors.request.use(
    (config) => {
        const { auth } = store.getState()
        const accessToken = auth.session.token

        if (accessToken) {
            config.headers[REQUEST_HEADER_AUTH_KEY] =
                `${TOKEN_TYPE}${accessToken}`
        }

        try {
            if (config.params) {
                config.params = sanitizePayload(config.params)
            }

            if (config.data instanceof FormData) {
                config.data = sanitizeFormData(config.data)
            } else if (config.data) {
                config.data = sanitizePayload(config.data)
            }
        } catch (error) {
            if (error instanceof UnsafeInputError) {
                return Promise.reject(error)
            }
            return Promise.reject(
                new UnsafeInputError(
                    (error as { path?: string })?.path ?? 'unknown',
                ),
            )
        }

        return config
    },
    (error) => {
        return Promise.reject(error)
    },
)

BaseService.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response } = error

        if (response && unauthorizedCode.includes(response.status)) {
            store.dispatch(signOutSuccess())
        }

        return Promise.reject(error)
    },
)

export default BaseService
