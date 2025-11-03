import { Navigate } from 'react-router-dom'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

const EmailSettingsRedirect = () => {
    return <Navigate to={`${APP_PREFIX_PATH}/settings/email/config`} replace />
}

export default EmailSettingsRedirect
