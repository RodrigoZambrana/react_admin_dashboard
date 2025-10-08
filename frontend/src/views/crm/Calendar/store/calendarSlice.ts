import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
    apiCreateCustomerCalendarEvent,
    apiDeleteCustomerCalendarEvent,
    apiGetCustomerCalendar,
    apiUpdateCustomerCalendarEvent,
    type CalendarEventDto,
    type CalendarEventAddress,
    type CalendarEventAttachment,
} from '@/services/CustomersService'

export type CalendarEventExtendedProps = {
    type?: string
    eventType?: string
    eventTypeId?: string
    eventTypeName?: string
    location?: string
    address?: CalendarEventAddress
    detail?: string
    customerId?: string
    isInternal?: boolean
    attachments?: CalendarEventAttachment[]
}

export type CalendarEvent = {
    id: string
    title: string
    start: string
    end?: string
    allDay?: boolean
    eventColor: string
    groupId?: string
    eventTypeId?: string
    extendedProps?: CalendarEventExtendedProps
}

type Events = CalendarEvent[]

export type CalendarState = {
    loading: boolean
    eventList: Events
    dialogOpen: boolean
    selected: {
        type: string
    } & Partial<CalendarEvent>
}

export const SLICE_NAME = 'crmCalendar'

const mapDtoToStateEvent = (event: CalendarEventDto): CalendarEvent => ({
    ...event,
})

const dedupeEvents = (events: CalendarEvent[]) => {
    const map = new Map<string, CalendarEvent>()
    events.forEach((event) => {
        map.set(event.id, event)
    })
    return Array.from(map.values())
}

export const getEvents = createAsyncThunk(
    SLICE_NAME + '/getEvents',
    async () => {
        const events = await apiGetCustomerCalendar()
        return events.map(mapDtoToStateEvent)
    },
)

export const createCalendarEvent = createAsyncThunk(
    SLICE_NAME + '/createCalendarEvent',
    async (event: CalendarEvent) => {
        const created = await apiCreateCustomerCalendarEvent(event)
        return mapDtoToStateEvent(created)
    },
)

export const updateCalendarEvent = createAsyncThunk(
    SLICE_NAME + '/updateCalendarEvent',
    async (event: CalendarEvent) => {
        const updated = await apiUpdateCustomerCalendarEvent(String(event.id), event)
        return mapDtoToStateEvent(updated)
    },
)

export const deleteCalendarEvent = createAsyncThunk(
    SLICE_NAME + '/deleteCalendarEvent',
    async (id: string) => {
        const deletedId = await apiDeleteCustomerCalendarEvent(String(id))
        return String(deletedId)
    },
)

const initialState: CalendarState = {
    loading: false,
    eventList: [],
    dialogOpen: false,
    selected: {
        type: '',
    },
}

const calendarSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        openDialog: (state) => {
            state.dialogOpen = true
        },
        closeDialog: (state) => {
            state.dialogOpen = false
            state.selected = { type: '' }
        },
        setSelected: (state, action) => {
            state.selected = action.payload
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getEvents.pending, (state) => {
                state.loading = true
            })
            .addCase(getEvents.fulfilled, (state, action) => {
                state.eventList = dedupeEvents(action.payload)
                state.loading = false
            })
            .addCase(getEvents.rejected, (state) => {
                state.loading = false
            })
            .addCase(createCalendarEvent.pending, (state) => {
                state.loading = true
            })
            .addCase(createCalendarEvent.fulfilled, (state, action) => {
                state.eventList = dedupeEvents([
                    ...state.eventList,
                    action.payload,
                ])
                state.loading = false
                state.dialogOpen = false
                state.selected = { type: '' }
            })
            .addCase(createCalendarEvent.rejected, (state) => {
                state.loading = false
            })
            .addCase(updateCalendarEvent.pending, (state) => {
                state.loading = true
            })
            .addCase(updateCalendarEvent.fulfilled, (state, action) => {
                state.eventList = dedupeEvents([
                    ...state.eventList.filter(
                        (event) => event.id !== action.payload.id,
                    ),
                    action.payload,
                ])
                state.loading = false
                state.dialogOpen = false
            })
            .addCase(updateCalendarEvent.rejected, (state) => {
                state.loading = false
            })
            .addCase(deleteCalendarEvent.pending, (state) => {
                state.loading = true
            })
            .addCase(deleteCalendarEvent.fulfilled, (state, action) => {
                state.eventList = state.eventList.filter(
                    (event) => event.id !== action.payload,
                )
                state.loading = false
                state.dialogOpen = false
                state.selected = { type: '' }
            })
            .addCase(deleteCalendarEvent.rejected, (state) => {
                state.loading = false
            })
    },
})

export const { openDialog, closeDialog, setSelected } =
    calendarSlice.actions

export default calendarSlice.reducer
