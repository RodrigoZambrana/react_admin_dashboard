import { Navigate } from 'react-router-dom'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

const EmailTemplatesRedirect = () => {
    return <Navigate to={`${APP_PREFIX_PATH}/settings/email/config?tab=templates`} replace />
}

export default EmailTemplatesRedirect
