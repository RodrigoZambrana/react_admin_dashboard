import type { ReactNode } from 'react'

type MessagingConversationListItemProps = {
    selected?: boolean
    title: ReactNode
    subject?: ReactNode
    status?: ReactNode
    badges?: ReactNode
    metaLeft?: ReactNode
    metaRight?: ReactNode
    preview?: ReactNode
    onClick?: () => void
    testId?: string
}

const MessagingConversationListItem = ({
    selected = false,
    title,
    subject,
    status,
    badges,
    metaLeft,
    metaRight,
    preview,
    onClick,
    testId,
}: MessagingConversationListItemProps) => {
    return (
        <button
            type="button"
            className={`mx-3 my-1.5 flex w-[calc(100%-1.5rem)] flex-col gap-2 rounded-[24px] border px-4 py-4 text-left transition ${
                selected
                    ? 'border-sky-200 bg-sky-50 shadow-[0_10px_30px_rgba(14,165,233,0.10)]'
                    : 'border-white bg-white hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]'
            }`}
            data-testid={testId}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">
                        {title}
                    </div>
                    {subject ? (
                        <div className="truncate text-xs text-gray-500">
                            {subject}
                        </div>
                    ) : null}
                </div>
                {status}
            </div>

            {badges ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {badges}
                </div>
            ) : null}

            {metaLeft || metaRight ? (
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span className="truncate">{metaLeft}</span>
                    <span>{metaRight}</span>
                </div>
            ) : null}

            {preview ? (
                <div className="truncate text-sm text-gray-600">{preview}</div>
            ) : null}
        </button>
    )
}

export default MessagingConversationListItem
