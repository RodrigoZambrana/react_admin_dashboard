import Header from '@/components/template/Header'
import { appPath } from '@/constants/route.constant'
import SidePanel from '@/components/template/SidePanel'
import UserDropdown from '@/components/template/UserDropdown'
import LanguageSelector from '@/components/template/LanguageSelector'
import Notification from '@/components/template/Notification'
import MobileNav from '@/components/template/MobileNav'
import StackedSideNav from '@/components/template/StackedSideNav'
import View from '@/views'
import { useLocation } from 'react-router-dom'

const HeaderActionsStart = ({ isMessagingRoute }: { isMessagingRoute: boolean }) => {
    return (
        <>
            {isMessagingRoute ? null : <MobileNav />}
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

const StackedSideLayout = () => {
    const location = useLocation()
    const isMessagingRoute = location.pathname.startsWith(
        appPath('/crm/conversations'),
    )

    return (
        <div className="app-layout-stacked-side flex flex-auto flex-col">
            <div className="flex flex-auto min-w-0">
                {isMessagingRoute ? null : <StackedSideNav />}
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

export default StackedSideLayout
