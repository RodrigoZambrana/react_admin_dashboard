import { useEffect, useState } from 'react'

export interface NetworkStatus {
    isOnline: boolean
    lastChangedAt: number
}

export function useNetworkStatus(): NetworkStatus {
    const [state, setState] = useState<NetworkStatus>(() => ({
        isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
        lastChangedAt: Date.now(),
    }))

    useEffect(() => {
        const handleOnline = () =>
            setState({
                isOnline: true,
                lastChangedAt: Date.now(),
            })
        const handleOffline = () =>
            setState({
                isOnline: false,
                lastChangedAt: Date.now(),
            })

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    return state
}

export default useNetworkStatus
