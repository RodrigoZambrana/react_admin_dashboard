import Header from '@/components/template/Header'
import SideNavToggle from '@/components/template/SideNavToggle'
import LanguageSelector from '@/components/template/LanguageSelector'
import Notification from '@/components/template/Notification'
import SidePanel from '@/components/template/SidePanel'
import MobileNav from '@/components/template/MobileNav'
import UserDropdown from '@/components/template/UserDropdown'
import SideNav from '@/components/template/SideNav'
import View from '@/views'
import { useLocation } from 'react-router-dom'

const HeaderActionsStart = ({ isMessagingRoute }: { isMessagingRoute: boolean }) => {
    return (
        <>
            {isMessagingRoute ? null : (
                <>
                    <MobileNav />
                    <SideNavToggle />
                </>
            )}
        </>
    )
}

const HeaderActionsEnd = () => {
    return (
        <>
            <LanguageSelector />
            <Notification />
            <SidePanel />
            <UserDropdown hoverable={false} />
        </>
    )
}

const ClassicLayout = () => {
    const location = useLocation()
    const isMessagingRoute = location.pathname.startsWith(
        '/app/crm/conversations',
    )

    return (
        <div className="app-layout-classic flex flex-auto flex-col">
            <div className="flex flex-auto min-w-0">
                {isMessagingRoute ? null : <SideNav />}
                <div className="flex flex-col flex-auto min-h-screen min-w-0 relative w-full">
                    <Header
                        className="shadow-sm dark:shadow-2xl"
                        headerStart={
                            <HeaderActionsStart isMessagingRoute={isMessagingRoute} />
                        }
                        headerEnd={<HeaderActionsEnd />}
                    />
                    <div className="h-full flex flex-auto flex-col">
                        <View />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClassicLayout
