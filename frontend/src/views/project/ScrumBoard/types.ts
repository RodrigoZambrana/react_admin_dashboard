export interface Comment {
    id: string
    name: string
    src: string
    message: string
    date: number
}

export type Member = {
    id: string
    name: string
    email: string
    img: string
}

export type Ticket = {
    id: string
    columnId: string
    name: string
    description?: string | null
    cover?: string | null
    members: Member[]
    labels: string[]
    attachments?: {
        id: string
        name: string
        src: string
        size: string
    }[]
    comments?: Comment[]
    dueDate: number | null
    order: number
    priority?: string | null
}

export type Column = {
    id: string
    title: string
    sortOrder: number
    tickets: Ticket[]
}

export type Members = Member[]

export type Columns = Record<string, Column>
