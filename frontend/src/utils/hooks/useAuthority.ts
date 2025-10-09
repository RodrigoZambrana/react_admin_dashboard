import { useMemo } from 'react'
import isEmpty from 'lodash/isEmpty'
import { SUPERADMIN } from '@/constants/roles.constant'

function useAuthority(
    userAuthority: string[] = [],
    authority: string[] = [],
    emptyCheck = false,
) {
    const roleMatched = useMemo(() => {
        // SUPERADMIN bypass
        if (userAuthority.includes(SUPERADMIN)) return true
        return authority.some((role) => userAuthority.includes(role))
    }, [authority, userAuthority])

    if (
        isEmpty(authority) ||
        isEmpty(userAuthority) ||
        typeof authority === 'undefined'
    ) {
        return !emptyCheck
    }

    return roleMatched
}

export default useAuthority
