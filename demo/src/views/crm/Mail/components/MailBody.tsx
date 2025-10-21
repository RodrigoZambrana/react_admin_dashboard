import MailList from './MailList'
import MailDetail from './MailDetail'

const MailBody = () => {
    return (
        <div className="flex flex-auto w-full min-h-0">
            <MailList />
            <MailDetail />
        </div>
    )
}

export default MailBody
