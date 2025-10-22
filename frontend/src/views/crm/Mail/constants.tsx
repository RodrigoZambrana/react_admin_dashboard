import {
    HiOutlineInbox,
    HiOutlinePaperAirplane,
    HiOutlinePencil,
    HiOutlineStar,
    HiOutlineTrash,
    HiOutlineArchive,
    HiOutlineShieldExclamation,
    HiOutlineExclamationCircle,
} from 'react-icons/hi'
import type { JSX } from 'react'

export type MenuBase = {
    value: string
    label: string
}

export type Group = MenuBase & {
    icon?: JSX.Element
    translationValue?: string
}

export type Label = MenuBase & {
    dotClass: string
}

export const groupList: Group[] = [
    {
        value: 'inbox',
        label: 'Inbox',
        translationValue: 'inbox',
        icon: <HiOutlineInbox />,
    },
    {
        value: 'sentItem',
        label: 'Sent Item',
        translationValue: 'sentItem',
        icon: <HiOutlinePaperAirplane />,
    },
    {
        value: 'draft',
        label: 'Draft',
        translationValue: 'draft',
        icon: <HiOutlinePencil />,
    },
    {
        value: 'starred',
        label: 'Starred',
        translationValue: 'starred',
        icon: <HiOutlineStar />,
    },
    {
        value: 'deleted',
        label: 'Deleted',
        translationValue: 'deleted',
        icon: <HiOutlineTrash />,
    },
]

export const labelList: Label[] = [
    { value: 'work', label: 'Work', dotClass: 'bg-blue-500' },
    { value: 'private', label: 'Private', dotClass: 'bg-indigo-500' },
    { value: 'important', label: 'Important', dotClass: 'bg-red-500' },
]

export const dynamicMailboxIconMap: Record<string, JSX.Element> = {
    archive: <HiOutlineArchive />,
    spam: <HiOutlineShieldExclamation />,
    trash: <HiOutlineTrash />,
    junk: <HiOutlineExclamationCircle />,
}
