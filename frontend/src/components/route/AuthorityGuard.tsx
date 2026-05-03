import { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import useAuthority from '@/utils/hooks/useAuthority'
import { appPath } from '@/constants/route.constant'

type AuthorityGuardProps = PropsWithChildren<{
    userAuthority?: string[]
    authority?: string[]
}>

const AuthorityGuard = (props: AuthorityGuardProps) => {
    const { userAuthority = [], authority = [], children } = props

    const roleMatched = useAuthority(userAuthority, authority)

    // ProtectedRoute already ensures authentication.
    // Here, only handle insufficient authority -> Access Denied
    return <>{roleMatched ? children : <Navigate to={appPath('access-denied')} />}</>
}

export default AuthorityGuard
