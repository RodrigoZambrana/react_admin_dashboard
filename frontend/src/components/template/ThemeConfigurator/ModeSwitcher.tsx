import { useCallback } from 'react'
import useDarkMode from '@/utils/hooks/useDarkmode'
import Switcher from '@/components/ui/Switcher'

const ModeSwitcher = () => {
    const [isDark, setIsDark] = useDarkMode()

    const onSwitchChange = useCallback(
        (checked: boolean) => {
            setIsDark(checked ? 'dark' : 'light')
        },
        [setIsDark],
    )

    return (
        <div>
            <Switcher
                checked={isDark}
                onChange={(checked) => onSwitchChange(checked)}
            />
        </div>
    )
}

export default ModeSwitcher
