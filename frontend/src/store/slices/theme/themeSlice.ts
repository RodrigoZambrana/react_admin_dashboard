import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { themeConfig } from '@/configs/theme.config'
import {
    LAYOUT_TYPE_MODERN,
    LAYOUT_TYPE_CLASSIC,
    LAYOUT_TYPE_STACKED_SIDE,
    NAV_MODE_TRANSPARENT,
    NAV_MODE_LIGHT,
    NAV_MODE_DARK,
    NAV_MODE_THEMED,
    MODE_DARK,
    MODE_LIGHT,
    LAYOUT_TYPE_DECKED,
} from '@/constants/theme.constant'
import type {
    LayoutType,
    Mode,
    NavMode,
    ColorLevel,
    Direction,
} from '@/@types/theme'
import { apiGetThemeConfig, apiUpdateThemeConfig } from '@/services/SettingsService'

const initialNavMode = () => {
    if (
        themeConfig.layout.type === LAYOUT_TYPE_MODERN &&
        themeConfig.navMode !== NAV_MODE_THEMED
    ) {
        return NAV_MODE_TRANSPARENT
    }

    return themeConfig.navMode
}

export type ThemeState = {
    themeColor: string
    direction: Direction
    mode: Mode
    primaryColorLevel: ColorLevel
    panelExpand: boolean
    navMode: NavMode
    cardBordered: boolean
    layout: {
        type: LayoutType
        sideNavCollapse: boolean
        previousType?: LayoutType
    }
    isLoading: boolean
    isSaving: boolean
}

const initialState: ThemeState = {
    themeColor: themeConfig.themeColor,
    direction: themeConfig.direction,
    mode: themeConfig.mode,
    primaryColorLevel: themeConfig.primaryColorLevel,
    panelExpand: themeConfig.panelExpand,
    cardBordered: themeConfig.cardBordered,
    navMode: initialNavMode(),
    layout: themeConfig.layout,
    isLoading: false,
    isSaving: false,
}

type ThemeConfigDto = {
    themeColor: string
    direction: Direction
    mode: Mode
    primaryColorLevel: ColorLevel
    panelExpand: boolean
    navMode: NavMode
    cardBordered: boolean
    layout: {
        type: LayoutType
        sideNavCollapse: boolean
    }
}

const toThemeConfigDto = (state: ThemeState): ThemeConfigDto => ({
    themeColor: state.themeColor,
    direction: state.direction,
    mode: state.mode,
    primaryColorLevel: state.primaryColorLevel,
    panelExpand: false,
    navMode: state.navMode,
    cardBordered: state.cardBordered,
    layout: {
        type: state.layout.type,
        sideNavCollapse: state.layout.sideNavCollapse,
    },
})

const applyThemeConfigToState = (
    state: ThemeState,
    payload: ThemeConfigDto,
) => {
    state.themeColor = payload.themeColor
    state.direction = payload.direction
    state.mode = payload.mode
    state.primaryColorLevel = payload.primaryColorLevel
    state.panelExpand = payload.panelExpand
    state.navMode = payload.navMode
    state.cardBordered = payload.cardBordered
    state.layout = {
        ...state.layout,
        type: payload.layout.type,
        sideNavCollapse: payload.layout.sideNavCollapse,
    }
}

export const fetchThemeConfig = createAsyncThunk<ThemeConfigDto>(
    'theme/fetchThemeConfig',
    async () => {
        const { data } = await apiGetThemeConfig<ThemeConfigDto>()
        return data
    },
)

export const saveThemeConfig = createAsyncThunk<
    ThemeConfigDto,
    ThemeState
>('theme/saveThemeConfig', async (theme) => {
    const payload = toThemeConfigDto(theme)
    const { data } = await apiUpdateThemeConfig<ThemeConfigDto, ThemeConfigDto>(
        payload,
    )
    return data
})

const availableNavColorLayouts = [
    LAYOUT_TYPE_CLASSIC,
    LAYOUT_TYPE_STACKED_SIDE,
    LAYOUT_TYPE_DECKED,
]

export const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        setDirection: (state, action: PayloadAction<Direction>) => {
            state.direction = action.payload
        },
        setMode: (state, action: PayloadAction<Mode>) => {
            const availableColorNav = availableNavColorLayouts.includes(
                state.layout.type,
            )

            if (
                availableColorNav &&
                action.payload === MODE_DARK &&
                state.navMode !== NAV_MODE_THEMED
            ) {
                state.navMode = NAV_MODE_DARK
            }
            if (
                availableColorNav &&
                action.payload === MODE_LIGHT &&
                state.navMode !== NAV_MODE_THEMED
            ) {
                state.navMode = NAV_MODE_LIGHT
            }
            state.mode = action.payload
        },
        setLayout: (state, action: PayloadAction<LayoutType>) => {
            state.cardBordered = action.payload === LAYOUT_TYPE_MODERN
            if (action.payload === LAYOUT_TYPE_MODERN) {
                state.navMode = NAV_MODE_TRANSPARENT
            }

            const availableColorNav = availableNavColorLayouts.includes(
                action.payload,
            )

            if (availableColorNav && state.mode === MODE_LIGHT) {
                state.navMode = NAV_MODE_LIGHT
            }

            if (availableColorNav && state.mode === MODE_DARK) {
                state.navMode = NAV_MODE_DARK
            }

            state.layout = {
                ...state.layout,
                ...{ type: action.payload },
            }
        },
        setPreviousLayout: (state, action) => {
            state.layout.previousType = action.payload
        },
        setSideNavCollapse: (state, action) => {
            state.layout = {
                ...state.layout,
                ...{ sideNavCollapse: action.payload },
            }
        },
        setNavMode: (state, action: PayloadAction<NavMode | 'default'>) => {
            if (action.payload !== 'default') {
                state.navMode = action.payload
            } else {
                if (state.layout.type === LAYOUT_TYPE_MODERN) {
                    state.navMode = NAV_MODE_TRANSPARENT
                }

                const availableColorNav = availableNavColorLayouts.includes(
                    state.layout.type,
                )

                if (availableColorNav && state.mode === MODE_LIGHT) {
                    state.navMode = NAV_MODE_LIGHT
                }

                if (availableColorNav && state.mode === MODE_DARK) {
                    state.navMode = NAV_MODE_DARK
                }
            }
        },
        setPanelExpand: (state, action: PayloadAction<boolean>) => {
            state.panelExpand = action.payload
        },
        setThemeColor: (state, action: PayloadAction<string>) => {
            state.themeColor = action.payload
        },
        setThemeColorLevel: (state, action) => {
            state.primaryColorLevel = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchThemeConfig.pending, (state) => {
                state.isLoading = true
            })
            .addCase(fetchThemeConfig.fulfilled, (state, action) => {
                state.isLoading = false
                applyThemeConfigToState(state, action.payload)
            })
            .addCase(fetchThemeConfig.rejected, (state) => {
                state.isLoading = false
            })
            .addCase(saveThemeConfig.pending, (state) => {
                state.isSaving = true
            })
            .addCase(saveThemeConfig.fulfilled, (state, action) => {
                state.isSaving = false
                applyThemeConfigToState(state, action.payload)
            })
            .addCase(saveThemeConfig.rejected, (state) => {
                state.isSaving = false
            })
    },
})

export const {
    setDirection,
    setMode,
    setLayout,
    setSideNavCollapse,
    setNavMode,
    setPanelExpand,
    setThemeColor,
    setThemeColorLevel,
    setPreviousLayout,
} = themeSlice.actions

export default themeSlice.reducer
