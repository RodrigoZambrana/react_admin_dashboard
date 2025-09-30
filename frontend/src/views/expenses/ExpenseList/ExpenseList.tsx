import reducer from './store'
import { injectReducer } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import ExpensesTable from './components/ExpensesTable'
import ExpensesTableTools from './components/ExpensesTableTools'
import { useTranslation } from 'react-i18next'
import ExpenseDeleteConfirmation from './components/ExpenseDeleteConfirmation'

injectReducer('expensesList', reducer)

const ExpenseList = () => {
    const { t } = useTranslation()
    return (
        <AdaptableCard className="h-full" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{t('expenses.list.title')}</h3>
                <ExpensesTableTools />
            </div>
            <ExpensesTable />
            <ExpenseDeleteConfirmation />
        </AdaptableCard>
    )
}

export default ExpenseList

