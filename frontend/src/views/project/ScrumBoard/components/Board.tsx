import { useEffect, lazy, Suspense } from 'react'
import Dialog from '@/components/ui/Dialog'
import {
    Droppable,
    DragDropContext,
    DropResult,
    DraggableChildrenFn,
} from '@hello-pangea/dnd'
import {
    getBoards,
    reorderColumns,
    reorderTickets,
    closeDialog,
    useAppDispatch,
    useAppSelector,
    updateColumns,
    updateOrdered,
} from '../store'
import { reorder } from '../utils'
import BoardColumn from './BoardColumn'

export type BoardProps = {
    containerHeight?: boolean
    useClone?: DraggableChildrenFn
    isCombineEnabled?: boolean
    withScrollableColumns?: boolean
}

const TicketContent = lazy(() => import('./TicketContent'))
const AddNewTicketContent = lazy(() => import('./AddNewTicketContent'))
const AddNewColumnContent = lazy(() => import('./AddNewColumnContent'))
const AddNewMemberContent = lazy(() => import('./AddNewMemberContent'))

const Board = (props: BoardProps) => {
    const {
        containerHeight,
        useClone,
        isCombineEnabled,
        withScrollableColumns,
    } = props

    const dispatch = useAppDispatch()

    const columns = useAppSelector((state) => state.scrumBoard.data.columns)
    const ordered = useAppSelector((state) => state.scrumBoard.data.ordered)
    const dialogOpen = useAppSelector(
        (state) => state.scrumBoard.data.dialogOpen,
    )
    const dialogView = useAppSelector(
        (state) => state.scrumBoard.data.dialogView,
    )

    const onDialogClose = () => {
        dispatch(closeDialog())
    }
    useEffect(() => {
        dispatch(getBoards())
    }, [dispatch])

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return
        }

        const source = result.source
        const destination = result.destination

        if (
            source.droppableId === destination.droppableId &&
            source.index === destination.index
        ) {
            return
        }

        const isColumnDrag =
            source.droppableId === 'board' && destination.droppableId === 'board'

        if (isColumnDrag) {
            const newOrdered = reorder(ordered, source.index, destination.index)
            dispatch(updateOrdered(newOrdered))
            dispatch(reorderColumns(newOrdered))
            return
        }

        const sourceColumnId = source.droppableId
        const destinationColumnId = destination.droppableId

        const sourceColumn = columns[sourceColumnId]
        const destinationColumn = columns[destinationColumnId]

        if (!sourceColumn || !destinationColumn) {
            return
        }

        const updatedColumns = { ...columns }

        const sourceTickets = [...sourceColumn.tickets]
        const [movedTicket] = sourceTickets.splice(source.index, 1)

        if (!movedTicket) {
            return
        }

        if (sourceColumnId === destinationColumnId) {
            sourceTickets.splice(destination.index, 0, movedTicket)
            updatedColumns[sourceColumnId] = {
                ...sourceColumn,
                tickets: sourceTickets,
            }
        } else {
            const destinationTickets = [...destinationColumn.tickets]
            destinationTickets.splice(destination.index, 0, {
                ...movedTicket,
                columnId: destinationColumnId,
            })
            updatedColumns[sourceColumnId] = {
                ...sourceColumn,
                tickets: sourceTickets,
            }
            updatedColumns[destinationColumnId] = {
                ...destinationColumn,
                tickets: destinationTickets,
            }
        }

        dispatch(updateColumns(updatedColumns))

        const columnOrders = ordered.map((columnId) => ({
            columnId,
            ticketIds:
                updatedColumns[columnId]?.tickets.map((ticket) => ticket.id) || [],
        }))

        dispatch(reorderTickets({ columnOrders }))
    }

    return (
        <>
            <DragDropContext onDragEnd={(result) => onDragEnd(result)}>
                <Droppable
                    droppableId="board"
                    type="COLUMN"
                    direction="horizontal"
                    ignoreContainerClipping={containerHeight}
                    isCombineEnabled={isCombineEnabled}
                >
                    {(provided) => (
                        <div
                            ref={provided.innerRef}
                            className="scrumboard flex flex-col flex-auto w-full h-full mb-2"
                            {...provided.droppableProps}
                        >
                            <div className="scrumboard-body flex max-w-full overflow-x-auto h-full mt-4">
                                {ordered.map((columnId, index) => {
                                    const column = columns[columnId]
                                    if (!column) {
                                        return null
                                    }
                                    return (
                                        <BoardColumn
                                            key={column.id}
                                            index={index}
                                            column={column}
                                            isScrollable={withScrollableColumns}
                                            isCombineEnabled={isCombineEnabled}
                                            useClone={useClone}
                                        />
                                    )
                                })}
                                {provided.placeholder}
                            </div>
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            <Dialog
                isOpen={dialogOpen}
                width={dialogView !== 'TICKET' ? 520 : 800}
                closable={dialogView !== 'TICKET'}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <Suspense fallback={<></>}>
                    {dialogView === 'TICKET' && (
                        <TicketContent onTicketClose={onDialogClose} />
                    )}
                    {dialogView === 'NEW_TICKET' && <AddNewTicketContent />}
                    {dialogView === 'NEW_COLUMN' && <AddNewColumnContent />}
                    {dialogView === 'ADD_MEMBER' && <AddNewMemberContent />}
                </Suspense>
            </Dialog>
        </>
    )
}

export default Board
