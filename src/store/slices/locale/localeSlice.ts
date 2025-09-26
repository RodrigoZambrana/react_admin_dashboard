import { createSlice } from '@reduxjs/toolkit'
import appConfig from '@/configs/app.config'

export type LocaleState = {
    currentLang: string
}

const detectLang = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const lang = typeof navigator !== 'undefined' ? navigator.language : appConfig.locale
    return lang && lang.toLowerCase().startsWith('es') ? 'es' : 'en'
}

const initialState: LocaleState = {
    currentLang: detectLang(),
}

export const localeSlice = createSlice({
    name: 'locale',
    initialState,
    reducers: {
        setLang: (state, action) => {
            state.currentLang = action.payload
        },
    },
})

export const { setLang } = localeSlice.actions

export default localeSlice.reducer
