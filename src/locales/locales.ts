// eslint-disable-next-line import/no-named-as-default
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './lang/en.json'
import es from './lang/es.json'
import appConfig from '@/configs/app.config'

const resources = {
    en: {
        translation: en,
    },
    es: {
        translation: es,
    },
}

const normalizeLang = (lang?: string) => {
    const code = (lang || '').toLowerCase()
    if (code.startsWith('es')) return 'es'
    return 'en'
}

const initialLang = normalizeLang(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    typeof navigator !== 'undefined' ? navigator.language : appConfig.locale,
)

i18n.use(initReactI18next).init({
    resources,
    fallbackLng: appConfig.locale,
    lng: initialLang,
    interpolation: {
        escapeValue: false,
    },
})

export const dateLocales: {
    [key: string]: () => Promise<ILocale>
} = {
    en: () => import('dayjs/locale/en'),
    es: () => import('dayjs/locale/es'),
}

export default i18n
