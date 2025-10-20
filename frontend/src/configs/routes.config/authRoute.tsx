import { lazy } from 'react'
import type { Routes } from '@/@types/routes'
import { applyClientRouteOverrides } from '../clientConfig'

const baseAuthRoute: Routes = [
    {
        key: 'accessDenied',
        path: `/access-denied`,
        component: lazy(() => import('@/views/pages/AccessDenied')),
        authority: [],
    },
    {
        key: 'signIn',
        path: `/sign-in`,
        component: lazy(() => import('@/views/auth/SignIn')),
        authority: [],
    },
    {
        key: 'signUp',
        path: `/sign-up`,
        component: lazy(() => import('@/views/auth/SignUp')),
        authority: [],
    },
    {
        key: 'forgotPassword',
        path: `/forgot-password`,
        component: lazy(() => import('@/views/auth/ForgotPassword')),
        authority: [],
    },
    {
        key: 'resetPassword',
        path: `/reset-password`,
        component: lazy(() => import('@/views/auth/ResetPassword')),
        authority: [],
    },
    {
        key: 'signOut',
        path: `/sign-out`,
        component: lazy(() => import('@/views/auth/SignOut')),
        authority: [],
    },
]

const authRoute: Routes = applyClientRouteOverrides(
    baseAuthRoute,
    'public',
)

export default authRoute
