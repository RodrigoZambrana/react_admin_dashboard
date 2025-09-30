import { useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import useThemeClass from '@/utils/hooks/useThemeClass'
import { APP_NAME } from '@/constants/app.constant'
import { useNavigate } from 'react-router-dom'
import { HiOutlineLockClosed } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'

type QuickStartType = {
    key: 'completeAccount' | 'createWorkspace' | 'inviteTeam'
    id: string
    disabled: boolean
    callBack?: () => void
    navigate?: string
}

type QuickStartItemProps = Omit<QuickStartType, 'id' | 'label' | 'disabled'> & {
    title: string
    available: boolean
    index: number
    textTheme?: string
    borderTheme?: string
    path?: string
}

const quickStartList: QuickStartType[] = [
    {
        key: 'completeAccount',
        id: '0',
        disabled: false,
        navigate: '/app/account/kyc-form',
    },
    {
        key: 'createWorkspace',
        id: '1',
        disabled: true,
        callBack: () => ({}),
    },
    {
        key: 'inviteTeam',
        id: '2',
        disabled: true,
    },
]

const QuickStartItem = (props: QuickStartItemProps) => {
    const {
        title,
        desc,
        btnText,
        index,
        available,
        textTheme = '',
        borderTheme = '',
        path = '',
        callBack,
    } = props

    const navigate = useNavigate()

    const handleClick = () => {
        if (available) {
            callBack?.()
            if (path) {
                navigate(path)
            }
        }
    }

    return (
        <Card className="mb-4">
            <div className="md:flex items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    {!available ? (
                        <span className="text-3xl">
                            <HiOutlineLockClosed />
                        </span>
                    ) : (
                        <span
                            className={`font-semibold text-xl rounded-full border-2 min-w-[30px] h-[30px] flex items-center justify-center ${borderTheme} ${textTheme}`}
                        >
                            {index + 1}
                        </span>
                    )}
                    <div>
                        <h5>{title}</h5>
                        <p>{desc}</p>
                    </div>
                </div>
                <Button
                    disabled={!available}
                    variant="solid"
                    className="mt-4 md:mt-0"
                    size="sm"
                    onClick={handleClick}
                >
                    {btnText}
                </Button>
            </div>
        </Card>
    )
}

const QuickStart = () => {
    const { textTheme, borderTheme } = useThemeClass()
    const { t } = useTranslation()

    const [completion] = useState([
        { value: '0', completed: false, current: true },
        { value: '1', completed: false, current: false },
        { value: '2', completed: false, current: false },
    ])

    return (
        <div>
            <h3 className="mb-2 text-center">
                <span className={textTheme}>
                    {t('welcome.quickStart.title', { app: APP_NAME })}
                </span>
            </h3>
            <div className="mt-8 max-w-[800px] lg:min-w-[800px]">
                {quickStartList.map((item, index) => (
                    <QuickStartItem
                        key={item.id}
                        index={index}
                        textTheme={textTheme}
                        borderTheme={borderTheme}
                        title={t(`welcome.quickStart.items.${item.key}.title`)}
                        btnText={t(`welcome.quickStart.items.${item.key}.btn`)}
                        desc={t(`welcome.quickStart.items.${item.key}.desc`)}
                        available={completion.some(
                            (c) =>
                                c.value === item.id &&
                                (c.completed || c.current),
                        )}
                        path={item.navigate}
                        callBack={item.callBack}
                    />
                ))}
            </div>
        </div>
    )
}

export default QuickStart
