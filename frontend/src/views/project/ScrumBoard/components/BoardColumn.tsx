import { Draggable } from '@hello-pangea/dnd'
import BoardTitle from './BoardTitle'
import BoardCardList, { BaseBoardProps } from './BoardCardList'
import type { Column } from '../types'

interface BoardColumnProps extends BaseBoardProps {
    column: Column
    index: number
    isScrollable?: boolean
}

const BoardColumn = (props: BoardColumnProps) => {
    const {
        column,
        index,
        isScrollable,
        isCombineEnabled,
        useClone,
    } = props

    return (
        <Draggable draggableId={column.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    className="
							board-column 
							flex 
							flex-col
							mb-3
							min-w-[300px] 
							w-[300px] 
							max-w-[300px] 
							p-0
							rounded-lg
						"
                    {...provided.draggableProps}
                >
                    <BoardTitle
                        column={column}
                        dragHandleProps={provided.dragHandleProps}
                    />
                    <BoardCardList
                        listId={column.id}
                        listType="CONTENT"
                        className={snapshot.isDragging ? 'is-dragging' : ''}
                        contents={column.tickets}
                        internalScroll={isScrollable}
                        isCombineEnabled={isCombineEnabled}
                        useClone={useClone}
                    />
                </div>
            )}
        </Draggable>
    )
}

export default BoardColumn
