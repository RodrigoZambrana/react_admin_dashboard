import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorState from './ErrorState'

type AppErrorBoundaryProps = {
    children: ReactNode
}

type AppErrorBoundaryState = {
    hasError: boolean
    errorMessage?: string
}

class AppErrorBoundary extends Component<
    AppErrorBoundaryProps,
    AppErrorBoundaryState
> {
    state: AppErrorBoundaryState = {
        hasError: false,
        errorMessage: undefined,
    }

    static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
        return {
            hasError: true,
            errorMessage:
                error instanceof Error ? error.message : 'Unexpected application error',
        }
    }

    componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
        console.error('Admin application crashed', error, errorInfo)
    }

    private handleReload = () => {
        if (typeof window !== 'undefined') {
            window.location.reload()
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 p-6 md:p-10">
                    <div className="mx-auto max-w-3xl">
                        <ErrorState
                            title="No fue posible renderizar esta pantalla"
                            description={
                                this.state.errorMessage
                                    ? `El panel encontró un error inesperado: ${this.state.errorMessage}`
                                    : 'El panel encontró un error inesperado.'
                            }
                            onRetry={this.handleReload}
                            retryLabel="Recargar"
                        />
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default AppErrorBoundary
