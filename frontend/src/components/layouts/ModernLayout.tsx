import Header from '@/components/template/Header'
import { appPath } from '@/constants/route.constant'
import SidePanel from '@/components/template/SidePanel'
import UserDropdown from '@/components/template/UserDropdown'
import LanguageSelector from '@/components/template/LanguageSelector'
import Notification from '@/components/template/Notification'
import SideNavToggle from '@/components/template/SideNavToggle'
import MobileNav from '@/components/template/MobileNav'
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

const ModernLayout = () => {
    const location = useLocation()
    const isMessagingRoute = location.pathname.startsWith(
        appPath('/crm/conversations'),
    )

    return (
        <div className="app-layout-modern flex flex-auto flex-col">
            <div className="flex flex-auto min-w-0">
                {isMessagingRoute ? null : <SideNav />}
                <div className="flex flex-col flex-auto min-h-screen min-w-0 relative w-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
                    <Header
                        className="border-b border-gray-200 dark:border-gray-700"
                        headerEnd={<HeaderActionsEnd />}
                        headerStart={
                            <HeaderActionsStart isMessagingRoute={isMessagingRoute} />
                        }
                    />
                    <View />
                </div>
            </div>
        </div>
    )
}

export default ModernLayout
