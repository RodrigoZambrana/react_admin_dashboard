import { useEffect } from 'react'
import { useAppDispatch, useAppSelector, setCurrencyCatalog } from '@/store'
import { apiGetCurrencyCatalog } from '@/services/SettingsService'
import { primeCurrencyCatalog, type CurrencyCatalogPayload } from '@/utils/currency'

const useCurrencyCatalogBootstrap = (shouldLoad: boolean) => {
    const dispatch = useAppDispatch()
    const catalogState = useAppSelector((state) => state.currency.catalog)

    useEffect(() => {
        primeCurrencyCatalog({
            definitions: catalogState.definitions,
            defaults: catalogState.defaultCodes,
        })
    }, [catalogState.definitions, catalogState.defaultCodes])

    useEffect(() => {
        if (!shouldLoad || catalogState.loaded) {
            return
        }
        let cancelled = false
        const load = async () => {
            try {
                const res = await apiGetCurrencyCatalog<CurrencyCatalogPayload>()
                if (!cancelled && res?.data) {
                    primeCurrencyCatalog(res.data)
                    dispatch(setCurrencyCatalog(res.data))
                }
            } catch {
                if (!cancelled) {
                    primeCurrencyCatalog({ defaults: catalogState.defaultCodes })
                }
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [catalogState.defaultCodes, catalogState.loaded, dispatch, shouldLoad])
}

export default useCurrencyCatalogBootstrap
