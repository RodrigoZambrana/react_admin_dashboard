import { useEffect, useCallback } from 'react'
import {
    setLayout,
    setPreviousLayout,
    setCurrentRouteKey,
    useAppSelector,
    useAppDispatch,
} from '@/store'
import { useLocation } from 'react-router-dom'
import type { LayoutType } from '@/@types/theme'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import navigationConfig from '@/configs/navigation.config'
import { APP_NAME } from '@/constants/app.constant'
import type { Meta } from '@/@types/routes'
import type { NavigationTree } from '@/@types/navigation'

const findNavPath = (
    nodes: NavigationTree[],
    key: string,
    trail: NavigationTree[] = [],
): NavigationTree[] | null => {
    for (const node of nodes) {
        const path = [...trail, node]
        if (node.key === key) {
            return path
        }

        if (node.subMenu.length) {
            const childPath = findNavPath(node.subMenu, key, path)
            if (childPath) {
                return childPath
            }
        }
    }

    return null
}

const findBestPathByLocation = (
    nodes: NavigationTree[],
    pathname: string,
    trail: NavigationTree[] = [],
): NavigationTree[] | null => {
    let bestMatch: NavigationTree[] | null = null

    for (const node of nodes) {
        const path = [...trail, node]
        let match: NavigationTree[] | null = null

        if (node.path && pathname.startsWith(node.path)) {
            match = path
        }

        if (node.subMenu.length) {
            const childMatch = findBestPathByLocation(node.subMenu, pathname, path)
            if (childMatch) {
                match = childMatch
            }
        }

        if (match) {
            if (!bestMatch) {
                bestMatch = match
            } else {
                const currentLength =
                    match[match.length - 1]?.path?.length ?? 0
                const bestLength =
                    bestMatch[bestMatch.length - 1]?.path?.length ?? 0

                if (currentLength >= bestLength) {
                    bestMatch = match
                }
            }
        }
    }

    return bestMatch
}

const toTitleCase = (value: string) => {
    return value
        .split(' ')
        .map((word) => {
            if (!word) {
                return word
            }
            return word.charAt(0).toUpperCase() + word.slice(1)
        })
        .join(' ')
}

const sanitizeSegment = (segment: string) => {
    const decoded = decodeURIComponent(segment)
    if (!decoded) {
        return ''
    }

    if (/^\d+$/.test(decoded.trim())) {
        return ''
    }

    const withoutHyphen = decoded.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()

    if (!withoutHyphen) {
        return ''
    }

    return toTitleCase(withoutHyphen)
}

const deriveSegmentsFromPath = (pathname: string) => {
    return pathname
        .split('/')
        .filter((segment) => segment && segment !== 'app')
        .map((segment) => sanitizeSegment(segment))
        .filter((segment) => segment.length > 0)
}

export type AppRouteProps<T> = {
    component: ComponentType<T>
    routeKey: string
    layout?: LayoutType
}

const AppRoute = <T extends Record<string, unknown>>({
    component: Component,
    routeKey,
    ...props
}: AppRouteProps<T>) => {
    const location = useLocation()

    const dispatch = useAppDispatch()

    const { t, i18n } = useTranslation()

    const layoutType = useAppSelector((state) => state.theme.layout.type)
    const previousLayout = useAppSelector(
        (state) => state.theme.layout.previousType,
    )
    const currentRouteKey = useAppSelector(
        (state) => state.base.common.currentRouteKey,
    )

    const handleLayoutChange = useCallback(() => {
        if (currentRouteKey !== routeKey) {
            dispatch(setCurrentRouteKey(routeKey))
        }

        if (props.layout && props.layout !== layoutType) {
            dispatch(setPreviousLayout(layoutType))
            dispatch(setLayout(props.layout))
        }

        if (!props.layout && previousLayout && layoutType !== previousLayout) {
            dispatch(setLayout(previousLayout))
            dispatch(setPreviousLayout(''))
        }
    }, [dispatch, layoutType, previousLayout, props.layout, routeKey, currentRouteKey])

    useEffect(() => {
        handleLayoutChange()
    }, [location.pathname, handleLayoutChange])

    const headerProp = (props as { header?: Meta['header'] }).header
    const headerText = typeof headerProp === 'string' ? headerProp : ''

    useEffect(() => {
        const navPath =
            findNavPath(navigationConfig, routeKey) ||
            findBestPathByLocation(navigationConfig, location.pathname)

        let segments =
            navPath
                ?.filter((node) => node.type !== 'title')
                .map((node) => {
                    const translatedTitle = node.translateKey
                        ? t(node.translateKey)
                        : ''

                    if (translatedTitle && translatedTitle !== node.translateKey) {
                        return translatedTitle
                    }

                    return node.title
                })
                .filter((title) => title && title.trim().length > 0) ?? []

        if (
            headerText &&
            !segments.some(
                (segment) =>
                    segment.toLowerCase() === headerText.toLowerCase(),
            )
        ) {
            segments = [...segments, headerText]
        }

        if (!segments.length) {
            segments = deriveSegmentsFromPath(location.pathname)
        }

        const sectionTitle = segments.join('/')

        document.title = sectionTitle
            ? `${APP_NAME} - ${sectionTitle}`
            : APP_NAME
    }, [routeKey, location.pathname, headerText, t, i18n.language])

    return <Component {...(props as T)} />
}

export default AppRoute
