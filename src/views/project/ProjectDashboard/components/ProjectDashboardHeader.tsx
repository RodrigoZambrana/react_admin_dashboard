type ProjectDashboardHeaderProps = {
    userName?: string
    taskCount?: number
}

const ProjectDashboardHeader = ({
    userName,
    taskCount,
}: ProjectDashboardHeaderProps) => {
    const { t } = useTranslation()
    return (
        <div>
            <h4 className="mb-1">{t('project.dashboard.greeting', { name: userName })}</h4>
            <p>{t('project.dashboard.tasksOnHand', { count: taskCount })}</p>
        </div>
    )
}

export default ProjectDashboardHeader
import { useTranslation } from 'react-i18next'
