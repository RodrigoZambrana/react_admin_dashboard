import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiCreateActivitiesColumn,
    apiCreateActivitiesTicket,
    apiDeleteActivitiesColumn,
    apiDeleteActivitiesTicket,
    apiGetScrumBoardtMembers,
    apiGetScrumBoards,
    apiReorderActivitiesColumns,
    apiReorderActivitiesTickets,
    apiUpdateActivitiesColumn,
    apiUpdateActivitiesTicket,
} from '@/services/ProjectService'
import type { Members, Columns } from '../types'

const SLICE_NAME = 'scrumBoard'

export type ActivitiesMemberResponse = {
    id: number
    name: string
    email: string
    img: string
}

export type ActivityTicketResponse = {
    id: number
    columnId: number
    name: string
    description: string | null
    priority: string | null
    labels: string[]
    dueDate: number | null
    order: number
    cover: string | null
    members: ActivitiesMemberResponse[]
}

export type ActivityColumnResponse = {
    id: number
    title: string
    sortOrder: number
    tickets: ActivityTicketResponse[]
}

export type ActivitiesBoardResponse = {
    ordered: number[]
    columns: ActivityColumnResponse[]
}

type GetScrumBoardtMembersResponse = {
    participantMembers: ActivitiesMemberResponse[]
    allMembers: ActivitiesMemberResponse[]
}

const normalizeMembers = (members: ActivitiesMemberResponse[]): Members =>
    members.map((member) => ({
        id: String(member.id),
        name: member.name,
        email: member.email,
        img: member.img,
    }))

const normalizeBoardPayload = (
    payload: ActivitiesBoardResponse,
): { columns: Columns; ordered: string[] } => {
    const columns: Columns = {}
    const ordered = payload.ordered.map((id) => String(id))

    payload.columns.forEach((column) => {
        const columnId = String(column.id)
        columns[columnId] = {
            id: columnId,
            title: column.title,
            sortOrder: column.sortOrder,
            tickets: column.tickets.map((ticket) => ({
                id: String(ticket.id),
                columnId: String(ticket.columnId),
                name: ticket.name,
                description: ticket.description,
                priority: ticket.priority ?? undefined,
                labels: ticket.labels ?? [],
                dueDate: ticket.dueDate ?? null,
                order: ticket.order,
                cover: ticket.cover ?? undefined,
                members: normalizeMembers(ticket.members),
            })),
        }
    })

    return { columns, ordered }
}

export type ScrumBoardState = {
    loading: boolean
    columns: Columns
    ordered: string[]
    boardMembers: Members
    allMembers: Members
    dialogOpen: boolean
    dialogView: 'NEW_COLUMN' | 'TICKET' | 'ADD_MEMBER' | 'NEW_TICKET' | ''
    ticketId: string
    board: string
    selectedTab: string
}

export const getBoards = createAsyncThunk(
    `${SLICE_NAME}/getBoards`,
    async () => {
        const response = await apiGetScrumBoards<ActivitiesBoardResponse>()
        return response.data
    },
)

export const getMembers = createAsyncThunk(
    `${SLICE_NAME}/getMembers`,
    async () => {
        const response =
            await apiGetScrumBoardtMembers<GetScrumBoardtMembersResponse>()
        return response.data
    },
)

export const createColumn = createAsyncThunk(
    `${SLICE_NAME}/createColumn`,
    async (payload: { title: string }) => {
        const response = await apiCreateActivitiesColumn<ActivitiesBoardResponse>(
            payload,
        )
        return response.data
    },
)

export const updateColumn = createAsyncThunk(
    `${SLICE_NAME}/updateColumn`,
    async (payload: { columnId: string; title: string }) => {
        const response = await apiUpdateActivitiesColumn<ActivitiesBoardResponse>(
            Number(payload.columnId),
            { title: payload.title },
        )
        return response.data
    },
)

export const deleteColumn = createAsyncThunk(
    `${SLICE_NAME}/deleteColumn`,
    async (payload: { columnId: string }) => {
        const response = await apiDeleteActivitiesColumn<ActivitiesBoardResponse>(
            Number(payload.columnId),
        )
        return response.data
    },
)

export const reorderColumns = createAsyncThunk(
    `${SLICE_NAME}/reorderColumns`,
    async (columnIds: string[]) => {
        const response = await apiReorderActivitiesColumns<ActivitiesBoardResponse>(
            columnIds.map((id) => Number(id)),
        )
        return response.data
    },
)

export const createTicket = createAsyncThunk(
    `${SLICE_NAME}/createTicket`,
    async (
        payload: {
            columnId: string
            name: string
            description?: string
            priority?: string
            labels?: string[]
            dueDate?: string | number | null
            memberIds?: string[]
        },
    ) => {
        const response = await apiCreateActivitiesTicket<ActivitiesBoardResponse>({
            columnId: Number(payload.columnId),
            name: payload.name,
            description: payload.description,
            priority: payload.priority,
            labels: payload.labels,
            dueDate: payload.dueDate,
            memberIds: payload.memberIds?.map((id) => Number(id)),
        })
        return response.data
    },
)

export const updateTicket = createAsyncThunk(
    `${SLICE_NAME}/updateTicket`,
    async (
        payload: {
            ticketId: string
            data: {
                columnId?: string
                name?: string
                description?: string | null
                priority?: string | null
                labels?: string[]
                dueDate?: string | number | null
                memberIds?: string[]
                order?: number
            }
        },
    ) => {
        const { ticketId, data } = payload
        const response = await apiUpdateActivitiesTicket<ActivitiesBoardResponse>(
            Number(ticketId),
            {
                columnId: data.columnId ? Number(data.columnId) : undefined,
                name: data.name,
                description: data.description,
                priority: data.priority,
                labels: data.labels,
                dueDate: data.dueDate,
                memberIds: data.memberIds?.map((id) => Number(id)),
                order: data.order,
            },
        )
        return response.data
    },
)

export const deleteTicket = createAsyncThunk(
    `${SLICE_NAME}/deleteTicket`,
    async (payload: { ticketId: string }) => {
        const response = await apiDeleteActivitiesTicket<ActivitiesBoardResponse>(
            Number(payload.ticketId),
        )
        return response.data
    },
)

export const reorderTickets = createAsyncThunk(
    `${SLICE_NAME}/reorderTickets`,
    async (
        payload: {
            columnOrders: { columnId: string; ticketIds: string[] }[]
        },
    ) => {
        const response = await apiReorderActivitiesTickets<ActivitiesBoardResponse>(
            payload.columnOrders.map((order) => ({
                columnId: Number(order.columnId),
                ticketIds: order.ticketIds.map((id) => Number(id)),
            })),
        )
        return response.data
    },
)

const initialState: ScrumBoardState = {
    loading: false,
    columns: {},
    ordered: [],
    boardMembers: [],
    allMembers: [],
    dialogOpen: false,
    dialogView: '',
    ticketId: '',
    board: '',
    selectedTab: 'all',
}

const applyBoardState = (
    state: ScrumBoardState,
    action: { payload?: ActivitiesBoardResponse },
) => {
    if (!action.payload) {
        return
    }

    const { columns, ordered } = normalizeBoardPayload(action.payload)
    state.columns = columns
    state.ordered = ordered
}

const scrumBoardSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateOrdered: (state, action) => {
            state.ordered = action.payload
        },
        updateColumns: (state, action) => {
            state.columns = action.payload
        },
        updateBoardMembers: (state, action) => {
            state.boardMembers = action.payload
        },
        openDialog: (state) => {
            state.dialogOpen = true
        },
        closeDialog: (state) => {
            state.dialogOpen = false
            state.ticketId = ''
            state.board = ''
            state.dialogView = ''
        },
        updateDialogView: (state, action) => {
            state.dialogView = action.payload
        },
        setSelectedTicketId: (state, action) => {
            state.ticketId = action.payload
        },
        setSelectedBoard: (state, action) => {
            state.board = action.payload
        },
        setSelectedTab: (state, action) => {
            state.selectedTab = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getBoards.pending, (state) => {
                state.loading = true
            })
            .addCase(getBoards.fulfilled, (state, { payload }) => {
                applyBoardState(state, { payload })
                state.loading = false
            })
            .addCase(getBoards.rejected, (state) => {
                state.loading = false
            })
            .addCase(getMembers.fulfilled, (state, action) => {
                state.boardMembers = normalizeMembers(
                    action.payload.participantMembers,
                )
                state.allMembers = normalizeMembers(action.payload.allMembers)
            })
            .addCase(createColumn.fulfilled, applyBoardState)
            .addCase(updateColumn.fulfilled, applyBoardState)
            .addCase(deleteColumn.fulfilled, applyBoardState)
            .addCase(reorderColumns.fulfilled, applyBoardState)
            .addCase(createTicket.fulfilled, applyBoardState)
            .addCase(updateTicket.fulfilled, applyBoardState)
            .addCase(deleteTicket.fulfilled, applyBoardState)
            .addCase(reorderTickets.fulfilled, applyBoardState)
    },
})

export const {
    updateOrdered,
    updateColumns,
    updateBoardMembers,
    openDialog,
    updateDialogView,
    closeDialog,
    setSelectedTicketId,
    setSelectedBoard,
    setSelectedTab,
} = scrumBoardSlice.actions

export { SLICE_NAME }
export default scrumBoardSlice.reducer
