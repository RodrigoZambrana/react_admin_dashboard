import type { ReactNode } from 'react'

type MessagingMessageBubbleProps = {
    className?: string
    toneClassName?: string
    headerLeft?: ReactNode
    headerRight?: ReactNode
    badges?: ReactNode
    meta?: ReactNode
    body: ReactNode
    bodyClassName?: string
    testId?: string
}

const MessagingMessageBubble = ({
    className,
    toneClassName = 'border-slate-200 bg-white',
    headerLeft,
    headerRight,
    badges,
    meta,
    body,
    bodyClassName,
    testId,
}: MessagingMessageBubbleProps) => {
    return (
        <div
            className={`rounded-[28px] border px-4 py-3.5 text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] ${toneClassName} ${className ?? ''}`}
            data-testid={testId}
        >
            {(headerLeft || headerRight) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{headerLeft}</div>
                    <div className="text-xs opacity-70">{headerRight}</div>
                </div>
            )}
            {badges ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs opacity-90">
                    {badges}
                </div>
            ) : null}
            {meta ? <div className="mt-2 text-[11px] opacity-75">{meta}</div> : null}
            <div
                className={`mt-3 whitespace-pre-wrap text-[13.5px] leading-6 ${bodyClassName ?? ''}`}
            >
                {body}
            </div>
        </div>
    )
}

export default MessagingMessageBubble
