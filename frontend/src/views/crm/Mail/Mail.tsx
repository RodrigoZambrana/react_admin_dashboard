import AdaptableCard from '@/components/shared/AdaptableCard'
import { appPath } from '@/constants/route.constant'
import MailSidebar from './components/MailSidebar'
import MailBody from './components/MailBody'
import { injectReducer } from '@/store/'
import reducer from './store'
import classNames from 'classnames'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    TbMessage2Heart,
    TbMailHeart,
    TbRobot,
    TbHome,
} from 'react-icons/tb'

injectReducer('crmMail', reducer)

const Mail = () => {
    const navigate = useNavigate()
    const location = useLocation()

    const railItems = [
        {
            key: 'messages',
            label: 'Mensajes',
            icon: TbMessage2Heart,
            to: appPath('/crm/conversations'),
            active: location.pathname.startsWith(appPath('/crm/conversations')),
        },
        {
            key: 'mail',
            label: 'Correo',
            icon: TbMailHeart,
            to: appPath('/crm/mail/inbox'),
            active: location.pathname.startsWith(appPath('/crm/mail')),
        },
        {
            key: 'ai',
            label: 'Agente de chat',
            icon: TbRobot,
            to: appPath('/settings/ai/runtime'),
            active: location.pathname.startsWith(appPath('/settings/ai')),
        },
        {
            key: 'general',
            label: 'General',
            icon: TbHome,
            to: appPath('/crm/customers'),
            active: false,
        },
    ]

    return (
        <AdaptableCard
            className="h-full overflow-hidden"
            bodyClass="p-0 h-full absolute inset-0 flex min-w-0 overflow-hidden"
        >
            <div className="hidden md:flex h-full w-[88px] shrink-0 flex-col items-center justify-between border-r border-gray-200 bg-white px-3 py-5 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white shadow-sm">
                    AI
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                    {railItems.map((item) => {
                        const Icon = item.icon
                        return (
                            <button
                                key={item.key}
                                type="button"
                                aria-label={item.label}
                                className={classNames(
                                    'flex h-12 w-12 items-center justify-center rounded-2xl border text-[22px] transition-colors',
                                    item.active
                                        ? 'border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-200'
                                        : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white',
                                )}
                                onClick={() => navigate(item.to)}
                            >
                                <Icon />
                            </button>
                        )
                    })}
                </div>
            </div>
            <MailSidebar />
            <MailBody />
        </AdaptableCard>
    )
}

export default Mail
