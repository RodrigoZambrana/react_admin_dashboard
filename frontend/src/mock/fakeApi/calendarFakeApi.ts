/* eslint-disable  @typescript-eslint/no-explicit-any */
import type { Server } from 'miragejs'

export default function calendarFakeApi(server: Server, apiPrefix: string) {
    server.get(`${apiPrefix}/calendar/activity`, (schema, { queryParams }) => {
        const { id } = queryParams
        const list = (schema.db as any).activityDetailData || []
        const idStr = String(id ?? '')
        const found = list.find((item: any) => String(item.id) === idStr)
        return found || list[0] || {}
    })
}
