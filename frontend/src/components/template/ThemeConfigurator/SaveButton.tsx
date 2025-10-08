import Notification from '@/components/ui/Notification'
import Button from '@/components/ui/Button'
import toast from '@/components/ui/toast'
import { useAppDispatch, useAppSelector } from '@/store'
import { saveThemeConfig } from '@/store/slices/theme/themeSlice'
import { useTranslation } from 'react-i18next'

type SaveButtonProps = {
    callBackClose?: () => void
}

const SaveButton = ({ callBackClose }: SaveButtonProps) => {
    const dispatch = useAppDispatch()
    const theme = useAppSelector((state) => state.theme)
    const { t } = useTranslation()

    const handleSave = async () => {
        try {
            await dispatch(saveThemeConfig(theme)).unwrap()
            toast.push(
                <Notification
                    title={t('theme.config.save.success.title')}
                    type="success"
                >
                    {t('theme.config.save.success.desc')}
                </Notification>,
                { placement: 'top-center' },
            )
            callBackClose?.()
        } catch (error: any) {
            const message =
                error?.response?.data?.message ||
                error?.message ||
                t('theme.config.save.error.desc')

            toast.push(
                <Notification
                    title={t('theme.config.save.error.title')}
                    type="danger"
                >
                    {message}
                </Notification>,
                { placement: 'top-center' },
            )
        }
    }

    return (
        <Button
            block
            variant="solid"
            loading={theme.isSaving}
            disabled={theme.isLoading}
            onClick={handleSave}
        >
            {t('theme.config.save.button')}
        </Button>
    )
}

export default SaveButton
