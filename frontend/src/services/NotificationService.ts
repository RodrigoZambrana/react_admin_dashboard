import ApiService from './ApiService'
import type { AxiosRequestConfig } from 'axios'

export type NotificationListResponse = {
    items: NotificationItem[]
    meta: {
        page: number
        pageSize: number
        total: number
        unread: number
    }
}

export type NotificationItem = {
    id: number
    eventType: string | null
    audience: string | null
    channel: string | null
    deliveryStatus: string
    title: string | null
    body: string | null
    metadata: Record<string, unknown> | null
    readAt: string | null
    createdAt: string
    orderId: number | null
    paymentId: number | null
}

export type NotificationSettingsResponse = NotificationSettingDto[]

export type NotificationSettingDto = {
    id: number
    eventType: string
    audience: string
    channel: string
    enabled: boolean
    roles: string[]
    templateKey: string | null
    localeOverrides: Record<string, unknown> | null
    emailSubject: string | null
    createdAt: string
    updatedAt: string
}

const NotificationService = {
    async fetchNotifications(params: {
        page?: number
        pageSize?: number
        eventType?: string | null
        channel?: string | null
        unreadOnly?: boolean
        since?: string | null
    }) {
        const request: AxiosRequestConfig = {
            url: '/notifications',
            method: 'get',
            params,
        }
        const response = await ApiService.fetchData<NotificationListResponse>(
            request,
        )
        return response.data
    },

    async fetchUnreadCount() {
        const response = await ApiService.fetchData<{ count: number }>({
            url: '/notifications/unread-count',
            method: 'get',
        })
        return response.data
    },

    async markAsRead(payload: { ids?: number[]; markAll?: boolean }) {
        const response = await ApiService.fetchData<{ success: boolean }, typeof payload>({
            url: '/notifications/read',
            method: 'post',
            data: payload,
        })
        return response.data
    },

    async deleteNotifications(payload: { ids?: number[]; deleteAll?: boolean }) {
        const response = await ApiService.fetchData<{ success: boolean }, typeof payload>({
            url: '/notifications',
            method: 'delete',
            data: payload,
        })
        return response.data
    },

    async deleteNotification(id: number) {
        const response = await ApiService.fetchData<{ success: boolean }>({
            url: `/notifications/${id}`,
            method: 'delete',
        })
        return response.data
    },

    async fetchSettings() {
        const response = await ApiService.fetchData<NotificationSettingsResponse>({
            url: '/notification-settings',
            method: 'get',
        })
        return response.data
    },

    async updateSettings(payload: { settings: NotificationSettingUpdateInput[] }) {
        const response = await ApiService.fetchData<NotificationSettingsResponse, typeof payload>({
            url: '/notification-settings',
            method: 'put',
            data: payload,
        })
        return response.data
    },
}

export type NotificationSettingUpdateInput = {
    eventType: string
    audience: string
    channel: string
    enabled: boolean
    roles: string[]
    templateKey?: string | null
    emailSubject?: string | null
    localeOverrides?: Record<string, unknown> | null
}

export default NotificationService
