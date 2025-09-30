import reducer from './store'
import { injectReducer } from '@/store'
import ExpensesDashboardHeader from './components/ExpensesDashboardHeader'
import ExpensesDashboardBody from './components/ExpensesDashboardBody'

injectReducer('expensesDashboard', reducer)

const ExpensesDashboard = () => {
    return (
        <div className="flex flex-col gap-4 h-full">
            <ExpensesDashboardHeader />
            <ExpensesDashboardBody />
        </div>
    )
}

export default ExpensesDashboard

