import { createAsyncThunk, createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit'
import NotificationService, {
    NotificationItem,
    NotificationListResponse,
    NotificationSettingDto,
    NotificationSettingUpdateInput,
} from '@/services/NotificationService'
import type { RootState } from '@/store'

export type NotificationState = {
    items: NotificationItem[]
    loading: boolean
    error: string | null
    unreadCount: number
    page: number
    pageSize: number
    total: number
    lastFetchedAt: string | null
    streaming: boolean
    settings: NotificationSettingDto[]
    settingsLoading: boolean
    settingsError: string | null
}

const initialState: NotificationState = {
    items: [],
    loading: false,
    error: null,
    unreadCount: 0,
    page: 1,
    pageSize: 20,
    total: 0,
    lastFetchedAt: null,
    streaming: false,
    settings: [],
    settingsLoading: false,
    settingsError: null,
}

export type FetchNotificationsParams = {
    page?: number
    pageSize?: number
    eventType?: string | null
    channel?: string | null
    unreadOnly?: boolean
}

export const fetchNotifications = createAsyncThunk<
    NotificationListResponse,
    FetchNotificationsParams | undefined,
    { rejectValue: string }
>('notifications/fetch', async (params, { rejectWithValue }) => {
    try {
        return await NotificationService.fetchNotifications(params ?? {})
    } catch (error) {
        return rejectWithValue((error as Error).message ?? 'Failed to load notifications')
    }
})

export const fetchUnreadCount = createAsyncThunk<
    number,
    void,
    { rejectValue: string }
>('notifications/unread', async (_, { rejectWithValue }) => {
    try {
        const result = await NotificationService.fetchUnreadCount()
        return result.count
    } catch (error) {
        return rejectWithValue((error as Error).message ?? 'Failed to load unread count')
    }
})

export const markNotificationsRead = createAsyncThunk<
    { ids?: number[]; markAll?: boolean },
    { ids?: number[]; markAll?: boolean },
    { rejectValue: string }
>('notifications/markRead', async (payload, { rejectWithValue }) => {
    try {
        await NotificationService.markAsRead(payload)
        return payload
    } catch (error) {
        return rejectWithValue((error as Error).message ?? 'Failed to update notifications')
    }
})

export const fetchNotificationSettings = createAsyncThunk<
    NotificationSettingDto[],
    void,
    { rejectValue: string }
>('notifications/fetchSettings', async (_, { rejectWithValue }) => {
    try {
        return await NotificationService.fetchSettings()
    } catch (error) {
        return rejectWithValue((error as Error).message ?? 'Failed to load notification settings')
    }
})

export const updateNotificationSettings = createAsyncThunk<
    NotificationSettingDto[],
    NotificationSettingUpdateInput[],
    { rejectValue: string }
>('notifications/updateSettings', async (settings, { rejectWithValue }) => {
    try {
        return await NotificationService.updateSettings({ settings })
    } catch (error) {
        return rejectWithValue((error as Error).message ?? 'Failed to update notification settings')
    }
})

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        notificationReceived(state, action: PayloadAction<NotificationItem>) {
            state.items = [action.payload, ...state.items].slice(0, state.pageSize)
            state.total += 1
            state.unreadCount += action.payload.readAt ? 0 : 1
            state.lastFetchedAt = new Date().toISOString()
        },
        setStreaming(state, action: PayloadAction<boolean>) {
            state.streaming = action.payload
        },
        clearNotifications(state) {
            state.items = []
            state.total = 0
            state.unreadCount = 0
            state.lastFetchedAt = null
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchNotifications.fulfilled, (state, action) => {
                state.loading = false
                state.items = action.payload.items
                state.page = action.payload.meta.page
                state.pageSize = action.payload.meta.pageSize
                state.total = action.payload.meta.total
                state.unreadCount = action.payload.meta.unread
                state.lastFetchedAt = new Date().toISOString()
            })
            .addCase(fetchNotifications.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload ?? 'Failed to load notifications'
            })
            .addCase(fetchUnreadCount.fulfilled, (state, action) => {
                state.unreadCount = action.payload
            })
            .addCase(fetchUnreadCount.rejected, (state, action) => {
                state.error = action.payload ?? 'Failed to load unread count'
            })
            .addCase(markNotificationsRead.fulfilled, (state, action) => {
                const { ids, markAll } = action.payload
                if (markAll) {
                    const timestamp = new Date().toISOString()
                    state.items = state.items.map((item) => ({
                        ...item,
                        readAt: item.readAt ?? timestamp,
                    }))
                    state.unreadCount = 0
                    return
                }
                if (ids && ids.length) {
                    const updateMap = new Set(ids)
                    const timestamp = new Date().toISOString()
                    state.items = state.items.map((item) =>
                        updateMap.has(item.id)
                            ? {
                                  ...item,
                                  readAt: item.readAt ?? timestamp,
                              }
                            : item,
                    )
                    const remainingUnread = state.items.filter((item) => !item.readAt).length
                    state.unreadCount = remainingUnread
                }
            })
            .addCase(fetchNotificationSettings.pending, (state) => {
                state.settingsLoading = true
                state.settingsError = null
            })
            .addCase(fetchNotificationSettings.fulfilled, (state, action) => {
                state.settingsLoading = false
                state.settings = action.payload
            })
            .addCase(fetchNotificationSettings.rejected, (state, action) => {
                state.settingsLoading = false
                state.settingsError = action.payload ?? 'Failed to load notification settings'
            })
            .addCase(updateNotificationSettings.pending, (state) => {
                state.settingsLoading = true
                state.settingsError = null
            })
            .addCase(updateNotificationSettings.fulfilled, (state, action) => {
                state.settingsLoading = false
                state.settings = action.payload
            })
            .addCase(updateNotificationSettings.rejected, (state, action) => {
                state.settingsLoading = false
                state.settingsError = action.payload ?? 'Failed to update notification settings'
            })
    },
})

export const { notificationReceived, setStreaming, clearNotifications } =
    notificationsSlice.actions

export const selectNotifications = (state: RootState) => state.notifications.items
export const selectNotificationsMeta = createSelector(
    (state: RootState) => state.notifications,
    (notifications) => ({
        loading: notifications.loading,
        error: notifications.error,
        unreadCount: notifications.unreadCount,
        total: notifications.total,
        page: notifications.page,
        pageSize: notifications.pageSize,
        streaming: notifications.streaming,
    }),
)
export const selectNotificationSettings = (state: RootState) => ({
    records: state.notifications.settings,
    loading: state.notifications.settingsLoading,
    error: state.notifications.settingsError,
})

export default notificationsSlice.reducer
