import ApiService from './ApiService'

export async function apiGetProjectDashboardData<T>() {
    return ApiService.fetchData<T>({
        url: '/project/dashboard',
        method: 'get',
    })
}

export async function apiGetProjectList<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/project/list',
        method: 'post',
        data,
    })
}

export async function apiPutProjectList<T, U extends Record<string, unknown>>(
    data: U,
) {
    return ApiService.fetchData<T>({
        url: '/project/list/add',
        method: 'put',
        data,
    })
}

export async function apiGetScrumBoards<T>() {
    return ApiService.fetchData<T>({
        url: '/activities/board',
        method: 'get',
    })
}

export async function apiGetScrumBoardtMembers<T>() {
    return ApiService.fetchData<T>({
        url: '/activities/members',
        method: 'get',
    })
}

export async function apiCreateActivitiesColumn<T>(data: { title: string }) {
    return ApiService.fetchData<T>({
        url: '/activities/columns',
        method: 'post',
        data,
    })
}

export async function apiReorderActivitiesColumns<T>(columnIds: number[]) {
    return ApiService.fetchData<T>({
        url: '/activities/columns/reorder',
        method: 'patch',
        data: { columnIds },
    })
}

export async function apiUpdateActivitiesColumn<T>(
    columnId: number,
    data: { title?: string },
) {
    return ApiService.fetchData<T>({
        url: `/activities/columns/${columnId}`,
        method: 'patch',
        data,
    })
}

export async function apiDeleteActivitiesColumn<T>(columnId: number) {
    return ApiService.fetchData<T>({
        url: `/activities/columns/${columnId}`,
        method: 'delete',
    })
}

export async function apiCreateActivitiesTicket<T>(
    data: {
        columnId: number
        name: string
        description?: string
        priority?: string
        labels?: string[]
        dueDate?: string | number | null
        memberIds?: number[]
    },
) {
    return ApiService.fetchData<T>({
        url: '/activities/tickets',
        method: 'post',
        data,
    })
}

export async function apiReorderActivitiesTickets<T>(
    columnOrders: { columnId: number; ticketIds: number[] }[],
) {
    return ApiService.fetchData<T>({
        url: '/activities/tickets/reorder',
        method: 'patch',
        data: { columnOrders },
    })
}

export async function apiUpdateActivitiesTicket<T>(
    ticketId: number,
    data: {
        columnId?: number
        name?: string
        description?: string | null
        priority?: string | null
        labels?: string[]
        dueDate?: string | number | null
        memberIds?: number[]
        order?: number
    },
) {
    return ApiService.fetchData<T>({
        url: `/activities/tickets/${ticketId}`,
        method: 'patch',
        data,
    })
}

export async function apiDeleteActivitiesTicket<T>(ticketId: number) {
    return ApiService.fetchData<T>({
        url: `/activities/tickets/${ticketId}`,
        method: 'delete',
    })
}

export async function apiGetScrumBoardtTicketDetail<T>() {
    return ApiService.fetchData<T>({
        url: '/project/scrum-board/tickets/detail',
        method: 'get',
    })
}
