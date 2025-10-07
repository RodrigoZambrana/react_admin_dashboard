import { useMemo } from 'react'
import Avatar from '@/components/ui/Avatar'
import acronym from '@/utils/acronym'
import useTwColorByName from '@/utils/hooks/useTwColorByName'
import {
    HiLogin,
    HiUserCircle,
    HiDeviceMobile,
    HiKey,
    HiShieldExclamation,
} from 'react-icons/hi'
import {
    LOGIN,
    DEVICE_SIGN_IN,
    PASSWORD_CHANGE,
    PROFILE_UPDATE,
    SECURITY_ALERT,
    avatarType,
    iconType,
} from '../constants'
import type { AvatarProps } from '@/components/ui/Avatar'

type TimelineAvatar = {
    data?: {
        type: string
        userImg?: string
        userName: string
    }
}

const Icon = ({ type }: { type: string }) => {
    switch (type) {
        case PASSWORD_CHANGE:
            return <HiKey />
        case SECURITY_ALERT:
            return <HiShieldExclamation />
        case LOGIN:
            return <HiLogin />
        case DEVICE_SIGN_IN:
            return <HiDeviceMobile />
        case PROFILE_UPDATE:
            return <HiUserCircle />
        default:
            return <HiUserCircle />
    }
}

const TimelineAvatar = ({ data }: TimelineAvatar) => {
    const color = useTwColorByName()

    const defaultAvatarProps: AvatarProps = useMemo(
        () => ({ size: 30, shape: 'circle' }),
        [],
    )

    if (data && avatarType.includes(data.type)) {
        const avatarProps = data.userImg
            ? { src: data.userImg }
            : { className: `${color(data.userName || '')}` }

        return (
            <Avatar {...avatarProps} {...defaultAvatarProps}>
                {acronym(data.userName || '')}
            </Avatar>
        )
    }

    if (data && iconType.includes(data.type)) {
        return (
            <Avatar
                className="text-gray-700 bg-gray-200 dark:text-gray-100"
                icon={<Icon type={data.type} />}
                {...defaultAvatarProps}
            />
        )
    }

    return null
}

export default TimelineAvatar
