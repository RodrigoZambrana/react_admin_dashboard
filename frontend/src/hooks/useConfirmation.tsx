import { useCallback, useMemo, useState, type ReactNode } from 'react'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

type StatusType = 'info' | 'success' | 'warning' | 'danger'

type ConfirmationOptions = {
    title?: ReactNode
    message?: ReactNode
    confirmText?: ReactNode
    cancelText?: ReactNode
    confirmButtonColor?: string
    type?: StatusType
}

type InternalState = ConfirmationOptions & {
    open: boolean
}

type Resolver = (confirmed: boolean) => void

const DEFAULT_STATE: InternalState = {
    open: false,
    type: 'danger',
    confirmButtonColor: 'red-600',
}

export const useConfirmation = () => {
    const [state, setState] = useState<InternalState>(DEFAULT_STATE)
    const [resolver, setResolver] = useState<Resolver | null>(null)

    const confirm = useCallback(
        (options: ConfirmationOptions) =>
            new Promise<boolean>((resolve) => {
                setState({
                    ...DEFAULT_STATE,
                    ...options,
                    open: true,
                })
                setResolver(() => resolve)
            }),
        [],
    )

    const closeDialog = useCallback(
        (result: boolean) => {
            setState((prev) => ({
                ...prev,
                open: false,
            }))
            resolver?.(result)
            setResolver(null)
        },
        [resolver],
    )

    const handleCancel = useCallback(() => {
        closeDialog(false)
    }, [closeDialog])

    const handleConfirm = useCallback(() => {
        closeDialog(true)
    }, [closeDialog])

    const confirmationDialog = useMemo(() => {
        if (!state.open) {
            return null
        }
        return (
            <ConfirmDialog
                isOpen={state.open}
                type={state.type}
                title={state.title}
                confirmButtonColor={state.confirmButtonColor}
                onClose={handleCancel}
                onRequestClose={handleCancel}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
                cancelText={state.cancelText}
                confirmText={state.confirmText}
            >
                {typeof state.message === 'string' ? <p>{state.message}</p> : state.message}
            </ConfirmDialog>
        )
    }, [handleCancel, handleConfirm, state])

    return {
        confirm,
        ConfirmationDialog: confirmationDialog,
    }
}

export default useConfirmation
