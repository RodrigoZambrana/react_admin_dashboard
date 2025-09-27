import { useState, useEffect } from 'react'

export default function useWindowSize() {
    const [windowSize, setWindowSize] = useState<{
        width?: number
        height?: number
    }>({
        width: undefined,
        height: undefined,
    })
    useEffect(() => {
        function handleResize() {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }
        window.addEventListener('resize', handleResize, { passive: true })
        handleResize()
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return windowSize
}
