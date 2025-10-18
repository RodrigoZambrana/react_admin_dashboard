import reducer from './store'
import { injectReducer } from '@/store'
import AccountingDashboardHeader from './components/AccountingDashboardHeader'
import AccountingDashboardBody from './components/AccountingDashboardBody'

injectReducer('accountingDashboard', reducer)

const AccountingDashboard = () => {
    return (
        <div className="flex flex-col gap-4 h-full">
            <AccountingDashboardHeader />
            <AccountingDashboardBody />
        </div>
    )
}

export default AccountingDashboard

