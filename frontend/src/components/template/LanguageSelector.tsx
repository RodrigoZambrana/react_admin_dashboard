import { useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Dropdown from '@/components/ui/Dropdown'
import Spinner from '@/components/ui/Spinner'
import classNames from 'classnames'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import { setLang, useAppSelector, useAppDispatch } from '@/store'
import { dateLocales } from '@/locales'
import dayjs from 'dayjs'
// eslint-disable-next-line import/no-named-as-default
import i18n from 'i18next'
import { HiCheck } from 'react-icons/hi'
import type { CommonProps } from '@/@types/common'
import { apiUpdateAccountLanguage } from '@/services/AccountServices'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useTranslation } from 'react-i18next'

const languageList = [
    { label: 'English', value: 'en', flag: 'us' },
    { label: 'Español', value: 'es', flag: 'sp' },
]

const _LanguageSelector = ({ className }: CommonProps) => {
    const [loading, setLoading] = useState(false)
    const locale = useAppSelector((state) => state.locale.currentLang)
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const selectLangFlag = useMemo(() => {
        return languageList.find((lang) => lang.value === locale)?.flag
    }, [locale])

    const selectedLanguage = (
        <div className={classNames(className, 'flex items-center')}>
            {loading ? (
                <Spinner size={20} />
            ) : (
                <Avatar
                    size={24}
                    shape="circle"
                    src={`/img/countries/${selectLangFlag}.png`}
                />
            )}
        </div>
    )

    const ensureDateLocale = async (lang: string) => {
        const loader = dateLocales[lang]
        if (loader) {
            try {
                await loader()
            } catch {
                // ignore load failure
            }
        }
        dayjs.locale(lang)
    }

    const formatLangCode = (lang: string) =>
        lang.replace(/-([a-z])/g, (g) => g[1].toUpperCase())

    const onLanguageSelect = async (lang: string) => {
        if (lang === locale || loading) {
            return
        }

        const formattedLang = formatLangCode(lang)

        const previousLocale = locale
        const previousFormatted = formatLangCode(previousLocale)

        setLoading(true)

        const applyLocale = (targetLang: string) => {
            i18n.changeLanguage(targetLang)
            dispatch(setLang(targetLang))
        }

        applyLocale(lang)
        await ensureDateLocale(formattedLang)

        try {
            await apiUpdateAccountLanguage({ lang })
        } catch (error) {
            applyLocale(previousLocale)
            await ensureDateLocale(previousFormatted)
            toast.push(
                <Notification
                    title={t('account.settings.profile.updateFailed', {
                        defaultValue: 'We could not update your profile.',
                    })}
                    type="danger"
                />,
                { placement: 'top-center' },
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dropdown renderTitle={selectedLanguage} placement="bottom-end">
            {languageList.map((lang) => (
                <Dropdown.Item
                    key={lang.label}
                    className="mb-1 justify-between"
                    eventKey={lang.label}
                    onClick={() => onLanguageSelect(lang.value)}
                >
                    <span className="flex items-center">
                        <Avatar
                            size={18}
                            shape="circle"
                            src={`/img/countries/${lang.flag}.png`}
                        />
                        <span className="ltr:ml-2 rtl:mr-2">{lang.label}</span>
                    </span>
                    {locale === lang.value && (
                        <HiCheck className="text-emerald-500 text-lg" />
                    )}
                </Dropdown.Item>
            ))}
        </Dropdown>
    )
}

const LanguageSelector = withHeaderItem(_LanguageSelector)

export default LanguageSelector
