import ExpenseStatuses from '@/views/settings/ExpenseStatuses'
import ExpenseCategories from '@/views/expenses/Categories'

const ExpenseSettings = () => {
    return (
        <div className="flex flex-col gap-4 h-full">
            <ExpenseCategories />
            <ExpenseStatuses />
        </div>
    )
}

export default ExpenseSettings

