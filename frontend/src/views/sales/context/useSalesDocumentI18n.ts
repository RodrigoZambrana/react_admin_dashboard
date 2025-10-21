import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSalesDocument } from './SalesDocumentContext'

export const useSalesDocumentI18n = () => {
    const config = useSalesDocument()
    const { t } = useTranslation()

    const tDoc = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            t(`${config.translationBase}.${key}`, {
                defaultValue: config.defaults[key] ?? options?.defaultValue,
                ...options,
            }),
        [config.defaults, config.translationBase, t],
    )

    return {
        ...config,
        t,
        tDoc,
    }
}

export type UseSalesDocumentI18nReturn = ReturnType<typeof useSalesDocumentI18n>
