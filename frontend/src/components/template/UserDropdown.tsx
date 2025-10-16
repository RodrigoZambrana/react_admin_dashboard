import Dropdown from '@/components/ui/Dropdown'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import useAuth from '@/utils/hooks/useAuth'
import { useAppSelector } from '@/store'
import { Link } from 'react-router-dom'
import classNames from 'classnames'
import { HiOutlineUser, HiOutlineCog, HiOutlineLogout } from 'react-icons/hi'
import { FiActivity } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import type { CommonProps } from '@/@types/common'
import type { JSX } from 'react'
import UserAvatar from '@/components/shared/UserAvatar'

type DropdownList = {
    labelKey: string
    path: string
    icon: JSX.Element
}

const dropdownItemList: DropdownList[] = [
    {
        labelKey: 'user.menu.profile',
        path: '/app/account/settings/profile',
        icon: <HiOutlineUser />,
    },
    {
        labelKey: 'user.menu.accountSetting',
        path: '/app/account/settings/profile',
        icon: <HiOutlineCog />,
    },
    {
        labelKey: 'user.menu.activityLog',
        path: '/app/account/activity-log',
        icon: <FiActivity />,
    },
]

const _UserDropdown = ({ className }: CommonProps) => {
    const { avatar, displayName, authority, email } = useAppSelector(
        (state) => state.auth.user,
    )

    const { signOut } = useAuth()
    const { t } = useTranslation()

    const primaryRole = authority?.[0] || 'guest'
    const formatRole = (role: string) => {
        const normalized = role.replace(/[_-]/g, ' ').toLowerCase()
        return normalized
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    }
    const roleLabel = formatRole(primaryRole)

    const UserSummary = (
        <div className={classNames(className, 'flex items-center gap-2')}>
            <UserAvatar size={32} shape="circle" src={avatar} />
            <div className="hidden md:block">
                <div className="font-bold leading-tight">{displayName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-300 capitalize">
                    {roleLabel}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-400">
                    {email}
                </div>
            </div>
        </div>
    )

    return (
        <div>
            <Dropdown
                menuStyle={{ minWidth: 240 }}
                renderTitle={UserSummary}
                placement="bottom-end"
            >
                <Dropdown.Item variant="header">
                    <div className="py-2 px-3 flex items-center gap-2">
                        <UserAvatar shape="circle" src={avatar} />
                        <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100">
                                {displayName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-300 capitalize">
                                {roleLabel}
                            </div>
                            <div className="text-xs">{email}</div>
                        </div>
                    </div>
                </Dropdown.Item>
                <Dropdown.Item variant="divider" />
                {dropdownItemList.map((item) => (
                    <Dropdown.Item
                        key={item.labelKey}
                        eventKey={item.labelKey}
                        className="mb-1 px-0"
                    >
                        <Link
                            className="flex h-full w-full px-2"
                            to={item.path}
                        >
                            <span className="flex gap-2 items-center w-full">
                                <span className="text-xl opacity-50">
                                    {item.icon}
                                </span>
                                <span>{t(item.labelKey)}</span>
                            </span>
                        </Link>
                    </Dropdown.Item>
                ))}
                <Dropdown.Item variant="divider" />
                <Dropdown.Item
                    eventKey="user.menu.signOut"
                    className="gap-2"
                    onClick={signOut}
                >
                    <span className="text-xl opacity-50">
                        <HiOutlineLogout />
                    </span>
                    <span>{t('user.menu.signOut')}</span>
                </Dropdown.Item>
            </Dropdown>
        </div>
    )
}

const UserDropdown = withHeaderItem(_UserDropdown)

export default UserDropdown
