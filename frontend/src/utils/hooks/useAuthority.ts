import { useMemo } from 'react'
import isEmpty from 'lodash/isEmpty'
import { SUPERADMIN } from '@/constants/roles.constant'
import {
    getFeatureAuthoritiesForCapabilityEnvelope,
    isFeatureAuthorityToken,
} from '@/constants/roleAccess.constant'
import { useAppSelector } from '@/store'

function useAuthority(
    userAuthority: string[] = [],
    authority: string[] = [],
    emptyCheck = false,
) {
    const capabilityEnvelope = useAppSelector(
        (state) => state.auth.user.capabilityEnvelope ?? [],
    )
    const capabilitySource = useAppSelector(
        (state) => state.auth.user.capabilitySource ?? 'none',
    )
    const featureAuthorities = useMemo(
        () => getFeatureAuthoritiesForCapabilityEnvelope(capabilityEnvelope),
        [capabilityEnvelope],
    )
    const requestedFeatureAuthorities = useMemo(
        () => authority.filter((entry) => isFeatureAuthorityToken(entry)),
        [authority],
    )

    const roleMatched = useMemo(() => {
        // SUPERADMIN bypass
        if (userAuthority.includes(SUPERADMIN)) return true

        if (
            capabilitySource === 'explicit' &&
            requestedFeatureAuthorities.length > 0
        ) {
            return requestedFeatureAuthorities.some((entry) =>
                featureAuthorities.includes(entry),
            )
        }

        return authority.some((role) => userAuthority.includes(role))
    }, [
        authority,
        capabilitySource,
        featureAuthorities,
        requestedFeatureAuthorities,
        userAuthority,
    ])

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
