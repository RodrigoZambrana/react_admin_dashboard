import { Navigate } from 'react-router-dom'
import { APP_PREFIX_PATH } from '@/constants/route.constant'

const MercadoPagoSettingsRedirect = () => {
    return <Navigate to={`${APP_PREFIX_PATH}/settings/email/config?section=mercadoPago`} replace />
}

export default MercadoPagoSettingsRedirect
