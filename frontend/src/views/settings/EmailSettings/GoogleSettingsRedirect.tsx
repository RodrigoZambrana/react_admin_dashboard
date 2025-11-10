import { Navigate } from 'react-router-dom'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

const GoogleSettingsRedirect = () => {
    return <Navigate to={`${APP_PREFIX_PATH}/settings/email/config?section=google`} replace />
}

export default GoogleSettingsRedirect
