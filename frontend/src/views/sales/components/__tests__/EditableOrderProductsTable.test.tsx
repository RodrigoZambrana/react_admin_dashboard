import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import EditableOrderProductsTable, {
    type EditableItem,
} from '../EditableOrderProductsTable'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) =>
            options?.defaultValue ?? key,
        i18n: { language: 'en' },
    }),
}))

vi.mock('@/store', () => ({
    useAppSelector: (selector: (state: { currency: { code: string } }) => string) =>
        selector({ currency: { code: 'USD' } } as any),
}))

const baseItem: EditableItem = {
    productId: '1',
    lineId: 'line-1',
    name: 'Test product',
    price: 10,
    qty: 1,
    comments: 'hola',
    currency: 'USD',
}

const noop = () => undefined

describe('EditableOrderProductsTable comment direction', () => {
    it('keeps Latin comments in left-to-right order when viewing and editing', () => {
        render(
            <EditableOrderProductsTable
                items={[baseItem]}
                onQtyChange={noop}
                onRemove={noop}
                showDescription={false}
                showImage={false}
                showComments
                onCommentChange={noop}
            />,
        )

        const commentDisplay = screen.getByText('hola')
        expect(commentDisplay).toHaveAttribute('dir', 'ltr')

        const editButton = screen.getByRole('button', { name: 'text.actions.edit' })
        fireEvent.click(editButton)

        const commentEditor = screen.getByDisplayValue('hola')
        expect(commentEditor).toHaveAttribute('dir', 'ltr')
    })

    it('switches to RTL when the comment contains RTL characters', () => {
        const rtlItem: EditableItem = { ...baseItem, comments: 'שלום' }
        render(
            <EditableOrderProductsTable
                items={[rtlItem]}
                onQtyChange={noop}
                onRemove={noop}
                showDescription={false}
                showImage={false}
                showComments
                onCommentChange={noop}
            />,
        )

        const commentDisplay = screen.getByText('שלום')
        expect(commentDisplay).toHaveAttribute('dir', 'rtl')

        const editButton = screen.getByRole('button', { name: 'text.actions.edit' })
        fireEvent.click(editButton)

        const commentEditor = screen.getByDisplayValue('שלום')
        expect(commentEditor).toHaveAttribute('dir', 'rtl')
    })

    it('updates comments only after clicking the save icon', () => {
        const handleCommentChange = vi.fn()
        render(
            <EditableOrderProductsTable
                items={[baseItem]}
                onQtyChange={noop}
                onRemove={noop}
                showDescription={false}
                showImage={false}
                showComments
                onCommentChange={handleCommentChange}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'text.actions.edit' }))

        const commentEditor = screen.getByDisplayValue('hola')
        fireEvent.change(commentEditor, { target: { value: 'hola mundo' } })

        expect(handleCommentChange).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'text.actions.save' }))

        expect(handleCommentChange).toHaveBeenCalledWith('line-1', 'hola mundo')
    })
})
