import { useEffect } from 'react'
import ConfigProvider from '@/components/ui/ConfigProvider'
import useDarkMode from '@/utils/hooks/useDarkmode'
import type { CommonProps } from '@/@types/common'
import { themeConfig } from '@/configs/theme.config'
import { useAppDispatch, useAppSelector } from '@/store'
import { fetchThemeConfig } from '@/store/slices/theme/themeSlice'

const Theme = (props: CommonProps) => {
    const dispatch = useAppDispatch()
    const theme = useAppSelector((state) => state.theme)
    const locale = useAppSelector((state) => state.locale.currentLang)

    useEffect(() => {
        dispatch(fetchThemeConfig())
    }, [dispatch])

    useDarkMode()

    const currentTheme = {
        ...themeConfig,
        ...theme,
        ...{ locale },
    }

    return (
        <ConfigProvider value={currentTheme}>{props.children}</ConfigProvider>
    )
}

export default Theme
