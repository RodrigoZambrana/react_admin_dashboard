import type { ReactNode } from 'react'

type MessagingShellProps = {
    sidebar?: ReactNode
    list: ReactNode
    detail: ReactNode
    isMobile?: boolean
    sidebarTestId?: string
}

const MessagingShell = ({
    sidebar,
    list,
    detail,
    isMobile = false,
    sidebarTestId = 'messaging-shell-sidebar',
}: MessagingShellProps) => {
    return (
        <>
            {sidebar ? (
                <div
                    className={`${
                        isMobile ? 'hidden' : 'flex'
                    } w-full min-h-0 shrink-0 flex-col border-r border-slate-200 bg-[#f7f8fc] lg:max-w-[360px]`}
                    data-testid={sidebarTestId}
                >
                    {sidebar}
                </div>
            ) : null}

            <div className="flex min-w-0 flex-1">
                {list}
                {detail}
            </div>
        </>
    )
}

export default MessagingShell
