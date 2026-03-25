import type { ReactNode } from 'react'

type MessagingPaneHeaderProps = {
    title: ReactNode
    subtitle?: ReactNode
    leading?: ReactNode
    trailing?: ReactNode
}

const MessagingPaneHeader = ({
    title,
    subtitle,
    leading,
    trailing,
}: MessagingPaneHeaderProps) => {
    return (
        <div className="relative z-10 flex min-h-[72px] shrink-0 items-center border-b border-slate-200 bg-white/95 px-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex w-full items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    {leading}
                    <div className="min-w-0">
                        <div className="truncate text-base font-semibold lg:text-lg">
                            {title}
                        </div>
                        {subtitle ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 lg:text-sm">
                                {subtitle}
                            </div>
                        ) : null}
                    </div>
                </div>
                {trailing ? (
                    <div className="flex items-center gap-2">{trailing}</div>
                ) : null}
            </div>
        </div>
    )
}

export default MessagingPaneHeader
