import { forwardRef } from 'react'
import Avatar from '@/components/ui/Avatar'
import { HiOutlineUser } from 'react-icons/hi'
import { resolveAvatarSrc } from '@/utils/avatar'
import type { AvatarProps } from '@/components/ui/Avatar'

type UserAvatarProps = Omit<AvatarProps, 'src'> & {
    src?: string | null | undefined
}

const UserAvatar = forwardRef<HTMLSpanElement, UserAvatarProps>(
    ({ src, icon, ...rest }, ref) => {
        const resolvedSrc = resolveAvatarSrc(src)
        const resolvedIcon = icon ?? <HiOutlineUser />

        return (
            <Avatar
                ref={ref}
                src={resolvedSrc}
                icon={resolvedIcon}
                {...rest}
            />
        )
    },
)

UserAvatar.displayName = 'UserAvatar'

export default UserAvatar

