// eslint-disable-next-line import/no-named-as-default
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './lang/en.json'
import es from './lang/es.json'
import appConfig from '@/configs/app.config'
import dayjs from 'dayjs'

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

// preload dayjs locale to make date components show correct month names
const loadDateLocale = async (lng: string) => {
    try {
        await dateLocales[lng]()
        dayjs.locale(lng)
    } catch {
        // ignore
    }
}

i18n.use(initReactI18next).init({
    resources,
    fallbackLng: appConfig.locale,
    lng: initialLang,
    interpolation: {
        escapeValue: false,
    },
})

// ensure dayjs locale matches the initial i18n language
loadDateLocale(initialLang)

export const dateLocales: {
    [key: string]: () => Promise<ILocale>
} = {
    en: () => import('dayjs/locale/en'),
    es: () => import('dayjs/locale/es'),
}

export default i18n
