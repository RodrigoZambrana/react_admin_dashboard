import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import Button from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import type { CallbackSetSkip } from '../types'

type Step1Props = CallbackSetSkip

const Step1 = ({ onNext, onSkip }: Step1Props) => {
    const { t } = useTranslation()
    return (
        <div className="text-center">
            <DoubleSidedImage
                className="mx-auto mb-8"
                src="/img/others/welcome.png"
                darkModeSrc="/img/others/welcome-dark.png"
                alt={t('nav.pages.welcome')}
            />
            <h3 className="mb-2">
                {t('welcome.step1.title')}
            </h3>
            <p className="text-base">
                {t('welcome.step1.subtitle')}
            </p>
            <div className="mt-8 max-w-[350px] mx-auto">
                <Button block className="mb-2" variant="solid" onClick={onNext}>
                    {t('welcome.step1.getStarted')}
                </Button>
                <Button block variant="plain" onClick={onSkip}>
                    {t('welcome.step1.skipNow')}
                </Button>
            </div>
        </div>
    )
}

export default Step1
