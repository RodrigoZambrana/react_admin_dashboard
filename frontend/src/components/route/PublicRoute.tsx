import { Navigate, Outlet, useLocation } from 'react-router-dom'
import appConfig from '@/configs/app.config'
import useAuth from '@/utils/hooks/useAuth'
import { useAppSelector } from '@/store'
import Loading from '@/components/shared/Loading'
import { appPath } from '@/constants/route.constant'

const { authenticatedEntryPath } = appConfig

const PublicRoute = () => {
    const { authenticated } = useAuth()
    const initialized = useAppSelector((state) => state.auth.session.initialized)
    const location = useLocation()

    if (!initialized) {
        return <Loading loading={true} />
    }

    // Allow access to Access Denied page even when authenticated
    if (location.pathname === appPath('access-denied')) {
        return <Outlet />
    }

    return authenticated ? <Navigate to={authenticatedEntryPath} /> : <Outlet />
}

export default PublicRoute
