import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import { useTranslation } from 'react-i18next'

const AccessDenied = () => {
    const { t } = useTranslation()
    return (
        <Container className="h-full">
            <div className="h-full flex flex-col items-center justify-center">
                <DoubleSidedImage
                    src="/img/others/img-2.png"
                    darkModeSrc="/img/others/img-2-dark.png"
                    alt={t('pages.accessDenied.title')}
                />
                <div className="mt-6 text-center">
                    <h3 className="mb-2">{t('pages.accessDenied.title')}</h3>
                    <p className="text-base">{t('pages.accessDenied.message')}</p>
                </div>
            </div>
        </Container>
    )
}

export default AccessDenied
