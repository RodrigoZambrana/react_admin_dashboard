import { lazy } from 'react'
import type { Routes } from '@/@types/routes'
import { applyClientRouteOverrides } from '../clientConfig'
import { appPath } from '@/constants/route.constant'

const baseAuthRoute: Routes = [
    {
        key: 'accessDenied',
        path: appPath('access-denied'),
        component: lazy(() => import('@/views/pages/AccessDenied')),
        authority: [],
    },
    {
        key: 'signIn',
        path: appPath('sign-in'),
        component: lazy(() => import('@/views/auth/SignIn')),
        authority: [],
    },
    {
        key: 'signUp',
        path: appPath('sign-up'),
        component: lazy(() => import('@/views/auth/SignUp')),
        authority: [],
    },
    {
        key: 'forgotPassword',
        path: appPath('forgot-password'),
        component: lazy(() => import('@/views/auth/ForgotPassword')),
        authority: [],
    },
    {
        key: 'resetPassword',
        path: appPath('reset-password'),
        component: lazy(() => import('@/views/auth/ResetPassword')),
        authority: [],
    },
    {
        key: 'signOut',
        path: appPath('sign-out'),
        component: lazy(() => import('@/views/auth/SignOut')),
        authority: [],
    },
]

const authRoute: Routes = applyClientRouteOverrides(
    baseAuthRoute,
    'public',
)

export default authRoute
