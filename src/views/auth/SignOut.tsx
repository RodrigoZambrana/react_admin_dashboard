import { useEffect } from 'react'
import useAuth from '@/utils/hooks/useAuth'
import { Loading } from '@/components/shared'

const SignOut = () => {
    const { signOut } = useAuth()

    useEffect(() => {
        // Trigger sign out on mount
        signOut()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="h-full flex items-center justify-center">
            <Loading loading={true} />
        </div>
    )
}

export default SignOut

