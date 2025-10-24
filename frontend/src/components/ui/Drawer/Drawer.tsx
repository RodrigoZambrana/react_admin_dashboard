import classNames from 'classnames'
import CloseButton from '../CloseButton'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
    CSSProperties,
    HTMLAttributes,
    MouseEvent as ReactMouseEvent,
    ReactNode,
} from 'react'

type Placement = 'top' | 'right' | 'bottom' | 'left'

type DrawerBaseProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'>

export interface DrawerProps extends DrawerBaseProps {
    bodyClass?: string
    bodyOpenClassName?: string
    children?: ReactNode
    closable?: boolean
    closeTimeoutMS?: number
    footer?: string | ReactNode
    footerClass?: string
    headerClass?: string
    height?: string | number
    isOpen: boolean
    lockScroll?: boolean
    onClose?: (event: MouseEvent | KeyboardEvent) => void
    onRequestClose?: (event: MouseEvent | KeyboardEvent) => void
    overlayClassName?: string
    placement?: Placement
    portalClassName?: string
    role?: string
    showBackdrop?: boolean
    shouldCloseOnEsc?: boolean
    shouldCloseOnOverlayClick?: boolean
    title?: string | ReactNode
    width?: string | number
}

const canUseDOM = typeof window !== 'undefined' && typeof document !== 'undefined'

const bodyClassUsage = new Map<string, number>()

const addBodyClasses = (classes: string[]) => {
    if (!canUseDOM || classes.length === 0) {
        return
    }
    classes.forEach((cls) => {
        if (!cls) {
            return
        }
        const current = bodyClassUsage.get(cls) ?? 0
        if (current === 0) {
            document.body.classList.add(cls)
        }
        bodyClassUsage.set(cls, current + 1)
    })
}

const removeBodyClasses = (classes: string[]) => {
    if (!canUseDOM || classes.length === 0) {
        return
    }
    classes.forEach((cls) => {
        if (!cls) {
            return
        }
        const current = bodyClassUsage.get(cls)
        if (!current) {
            return
        }
        if (current === 1) {
            document.body.classList.remove(cls)
            bodyClassUsage.delete(cls)
        } else {
            bodyClassUsage.set(cls, current - 1)
        }
    })
}

const defaultCloseTimeout = 300

const createSyntheticClick = () => {
    if (!canUseDOM || typeof window.MouseEvent !== 'function') {
        return undefined
    }
    return new window.MouseEvent('click')
}

const isMouseEvent = (event: unknown): event is MouseEvent => {
    return (
        canUseDOM &&
        typeof window.MouseEvent === 'function' &&
        event instanceof window.MouseEvent
    )
}

const isKeyboardEvent = (event: unknown): event is KeyboardEvent => {
    return (
        canUseDOM &&
        typeof window.KeyboardEvent === 'function' &&
        event instanceof window.KeyboardEvent
    )
}

const Drawer = (props: DrawerProps) => {
    const {
        bodyOpenClassName,
        bodyClass,
        children,
        className,
        closable = true,
        closeTimeoutMS = defaultCloseTimeout,
        footer,
        footerClass,
        headerClass,
        height = 400,
        isOpen,
        lockScroll = true,
        onClose,
        onRequestClose,
        overlayClassName,
        placement = 'right',
        portalClassName,
        role = 'dialog',
        showBackdrop = true,
        shouldCloseOnEsc = true,
        shouldCloseOnOverlayClick = true,
        title,
        width = 400,
        style,
        ...rest
    } = props

    const [shouldRender, setShouldRender] = useState<boolean>(() => {
        return canUseDOM ? isOpen : false
    })
    const closeTimerRef = useRef<ReturnType<typeof setTimeout>>()
    const portalNodeRef = useRef<HTMLDivElement | null>(null)

    const isClosing = shouldRender && !isOpen
    const afterOpen = shouldRender && isOpen

    useEffect(() => {
        if (!canUseDOM) {
            setShouldRender(false)
            return undefined
        }

        if (isOpen) {
            setShouldRender(true)
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current)
                closeTimerRef.current = undefined
            }
            return undefined
        }

        if (!shouldRender) {
            return undefined
        }

        if (closeTimeoutMS > 0) {
            closeTimerRef.current = window.setTimeout(() => {
                setShouldRender(false)
                closeTimerRef.current = undefined
            }, closeTimeoutMS)
            return () => {
                if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current)
                    closeTimerRef.current = undefined
                }
            }
        }

        setShouldRender(false)
        return undefined
    }, [isOpen, closeTimeoutMS, shouldRender])

    useEffect(() => {
        if (!canUseDOM || !shouldRender || !portalNodeRef.current) {
            return undefined
        }
        const node = portalNodeRef.current
        document.body.appendChild(node)
        return () => {
            if (node.parentNode) {
                node.parentNode.removeChild(node)
            }
        }
    }, [shouldRender])

    useEffect(() => {
        if (!canUseDOM || !portalNodeRef.current) {
            return
        }
        portalNodeRef.current.className = classNames('drawer-portal', portalClassName)
    }, [portalClassName, shouldRender])

    useEffect(() => {
        if (!canUseDOM || !shouldRender) {
            return
        }
        const classes = [
            'drawer-open',
            lockScroll ? 'drawer-lock-scroll' : '',
            ...(bodyOpenClassName ? bodyOpenClassName.split(' ') : []),
        ].filter(Boolean)
        addBodyClasses(classes)
        return () => removeBodyClasses(classes)
    }, [shouldRender, lockScroll, bodyOpenClassName])

    const requestClose = useCallback(
        (event?: MouseEvent | KeyboardEvent) => {
            if (!isOpen) {
                return
            }
            if (onRequestClose) {
                if (event) {
                    onRequestClose(event)
                } else {
                    const synthetic = createSyntheticClick()
                    if (synthetic) {
                        onRequestClose(synthetic)
                    }
                }
                return
            }
            if (onClose) {
                if (isMouseEvent(event) || isKeyboardEvent(event)) {
                    onClose(event)
                } else {
                    const synthetic = createSyntheticClick()
                    if (synthetic) {
                        onClose(synthetic)
                    }
                }
            }
        },
        [isOpen, onClose, onRequestClose],
    )

    const onCloseClick = (event: ReactMouseEvent<HTMLSpanElement>) => {
        requestClose(event.nativeEvent)
    }

    useEffect(() => {
        if (!canUseDOM || !shouldRender || !shouldCloseOnEsc) {
            return
        }
        const keyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                requestClose(event)
            }
        }
        document.addEventListener('keydown', keyHandler)
        return () => document.removeEventListener('keydown', keyHandler)
    }, [requestClose, shouldRender, shouldCloseOnEsc])

    useEffect(() => {
        if (!canUseDOM) {
            return
        }
        const handler = () => {
            if (!isOpen) {
                return
            }
            const synthetic = createSyntheticClick()
            if (synthetic) {
                requestClose(synthetic)
            } else {
                requestClose()
            }
        }
        window.addEventListener('app:drawer-close-all', handler)
        return () => window.removeEventListener('app:drawer-close-all', handler)
    }, [isOpen, requestClose])

    const handleOverlayClick = useCallback(
        (event: ReactMouseEvent<HTMLDivElement>) => {
            if (!shouldCloseOnOverlayClick) {
                return
            }
            if (event.target !== event.currentTarget) {
                return
            }
            requestClose(event.nativeEvent)
        },
        [requestClose, shouldCloseOnOverlayClick],
    )

    const { dimensionClass, contentStyle, motionStyle } = useMemo(() => {
        const resolveStyle = (): {
            dimensionClass?: string
            contentStyle?: CSSProperties
            motionStyle: Record<string, string>
        } => {
            if (placement === 'left' || placement === 'right') {
                const styles: CSSProperties = {
                    width,
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                }
                const widthOffset =
                    typeof width === 'number' ? `${width}px` : String(width)
                return {
                    dimensionClass: 'vertical',
                    contentStyle: styles,
                    motionStyle: {
                        [placement]: `-${widthOffset}`,
                    },
                }
            }

            if (placement === 'top' || placement === 'bottom') {
                const styles: CSSProperties = {
                    height,
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                }
                const heightOffset =
                    typeof height === 'number' ? `${height}px` : String(height)
                return {
                    dimensionClass: 'horizontal',
                    contentStyle: styles,
                    motionStyle: {
                        [placement]: `-${heightOffset}`,
                    },
                }
            }

            return {
                motionStyle: {},
            }
        }

        return resolveStyle()
    }, [placement, width, height])

    const motionAnimation = useMemo(() => {
        if (!motionStyle || Object.keys(motionStyle).length === 0) {
            return {}
        }
        return {
            [placement]: isOpen ? 0 : motionStyle[placement],
        }
    }, [motionStyle, placement, isOpen])

    if (canUseDOM && shouldRender && !portalNodeRef.current) {
        portalNodeRef.current = document.createElement('div')
    }

    if (!canUseDOM || !shouldRender || !portalNodeRef.current) {
        return null
    }

    const overlayClasses = classNames(
        'drawer-overlay',
        overlayClassName,
        !showBackdrop && 'bg-transparent',
        afterOpen && 'drawer-overlay-after-open',
        isClosing && 'drawer-overlay-before-close',
    )

    const containerClasses = classNames(
        'drawer',
        className,
        afterOpen && 'drawer-after-open',
        isClosing && 'drawer-before-close',
    )

    const rendered = (
        <div role="presentation" className={overlayClasses} onClick={handleOverlayClick}>
            <div
                aria-modal="true"
                role={role}
                className={containerClasses}
                style={style}
                {...rest}
            >
                <motion.div
                    className={classNames('drawer-content', dimensionClass)}
                    style={contentStyle}
                    initial={motionStyle}
                    animate={motionAnimation}
                >
                    {title || closable ? (
                        <div className={classNames('drawer-header', headerClass)}>
                            {typeof title === 'string' ? <h4>{title}</h4> : <span>{title}</span>}
                            {closable && <CloseButton onClick={onCloseClick} />}
                        </div>
                    ) : null}
                    <div className={classNames('drawer-body', bodyClass)}>{children}</div>
                    {footer ? (
                        <div className={classNames('drawer-footer', footerClass)}>
                            {footer}
                        </div>
                    ) : null}
                </motion.div>
            </div>
        </div>
    )

    return createPortal(rendered, portalNodeRef.current)
}

Drawer.displayName = 'Drawer'

export default Drawer
