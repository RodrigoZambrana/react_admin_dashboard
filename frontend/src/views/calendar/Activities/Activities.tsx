import { useEffect, useState } from 'react'
import { injectReducer } from '@/store'
import reducer, {
    getProjectDashboardData,
    useAppDispatch,
    useAppSelector,
} from '@/views/project/ProjectDashboard/store'
import Card from '@/components/ui/Card'
import Container from '@/components/shared/Container'
import Calendar from '@/components/ui/Calendar'
import Badge from '@/components/ui/Badge'
import classNames from 'classnames'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import useQuery from '@/utils/hooks/useQuery'

injectReducer('projectDashboard', reducer)

const CalendarActivities = () => {
    const dispatch = useAppDispatch()

    const dashboardData = useAppSelector(
        (state) => state.projectDashboard.data.dashboardData,
    )

    // Default selected date = today; can be overridden by query param ?date=YYYY-MM-DD
    const [selectedDate, setSelectedDate] = useState<Date | null>(dayjs().toDate())
    const { textTheme } = useThemeClass()
    const { t } = useTranslation()
    const query = useQuery()

    useEffect(() => {
        dispatch(getProjectDashboardData())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Read optional date from query param (YYYY-MM-DD) and set selection
    useEffect(() => {
        const q = query.get('date')
        if (q) {
            const d = dayjs(q, ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY'], true)
            if (d.isValid()) {
                setSelectedDate(d.toDate())
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const isToday = (someDate: Date) => {
        const today = new Date()
        return (
            someDate.getDate() === today.getDate() &&
            someDate.getMonth() === today.getMonth() &&
            someDate.getFullYear() === today.getFullYear()
        )
    }

    const events = dashboardData?.scheduleData || []
    const navigate = useNavigate()

    // In mock data we don't have per-day assignment; show all for now
    const eventsForDay = events

    return (
        <Container>
            <div className="flex flex-col gap-4">
                <Card className="mb-0">
                    <div className="mx-auto max-w-[700px] w-full">
                        <Calendar
                            value={selectedDate}
                            dayClassName={(date, { selected }) => {
                                const def = 'text-base'
                                if (isToday(date) && !selected) return classNames(def, textTheme)
                                if (selected) return classNames(def, 'text-white')
                                return def
                            }}
                            dayStyle={() => ({ height: 48 })}
                            renderDay={(date) => {
                                const day = date.getDate()
                                if (!isToday(date)) return <span>{day}</span>
                                return (
                                    <span className="relative flex justify-center items-center w-full h-full">
                                        {day}
                                        <Badge className="absolute bottom-1" innerClass="h-1 w-1" />
                                    </span>
                                )
                            }}
                            onChange={(val) => setSelectedDate(val)}
                        />
                    </div>
                </Card>
                <Card>
                    <h5 className="mb-4">
                        {t('text.titles.schedule')}
                        {selectedDate && ` + ${dayjs(selectedDate).format('DD/MM/YYYY')}`}
                    </h5>
                    {eventsForDay.map((event) => (
                        <div
                            key={event.id}
                            className="flex items-center justify-between rounded-md mb-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600/40 cursor-pointer user-select"
                            onClick={() => navigate(`/app/calendar/activities/details?id=${event.id}`)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={classNames('rounded-lg h-10 w-10 text-lg flex items-center justify-center',
                                    event.type === 'meeting' && 'text-indigo-600 bg-indigo-100 dark:text-indigo-100 dark:bg-indigo-500/20',
                                    event.type === 'task' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100',
                                    event.type === 'workshop' && 'text-amber-600 bg-amber-100 dark:text-amber-100 dark:bg-amber-500/20',
                                )}>
                                    {/* icons omitted in mock list */}
                                </div>
                                <div>
                                    <h6 className="text-sm font-bold">{event.eventName}</h6>
                                    <p>{event.desciption}</p>
                                </div>
                            </div>
                            <span>{event.time}</span>
                        </div>
                    ))}
                </Card>
            </div>
        </Container>
    )
}

export default CalendarActivities
