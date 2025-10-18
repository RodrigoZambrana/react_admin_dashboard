import { useTranslation } from 'react-i18next'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'

export type EditableItem = {
    productId: string
    name: string
    price: number
    qty: number
    img?: string
    description?: string
    currency?: string
}

type Props = {
    items: EditableItem[]
    onQtyChange: (productId: string, qty: number) => void
    onRemove: (productId: string) => void
    showDescription?: boolean
}

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<EditableItem>()

const stripHtml = (html?: string) =>
    (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const ProductCell = ({ row, showDescription }: { row: EditableItem; showDescription?: boolean }) => {
    const text = stripHtml(row.description)
    const excerpt = text.length > 120 ? text.slice(0, 120) + '…' : text
    return (
        <div className="flex">
            <Avatar size={90} src={row.img} />
            <div className="ltr:ml-3 rtl:mr-3">
                <h6 className="mb-2 leading-tight">{row.name}</h6>
                {showDescription && excerpt && (
                    <div className="text-sm opacity-80 leading-snug">{excerpt}</div>
                )}
            </div>
        </div>
    )
}

const EditableOrderProductsTable = ({ items, onQtyChange, onRemove, showDescription = true }: Props) => {
    const { t, i18n } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const formatAmount = (value: number, currency?: string) =>
        formatCurrency(value, currency, i18n.language, {
            fallbackCurrency: defaultCurrency,
        })

    const columns = [
        columnHelper.accessor('name', {
            header: t('text.columns.product'),
            cell: (props) => {
                const row = props.row.original
                return <ProductCell row={row} showDescription={showDescription} />
            },
        }),
        columnHelper.accessor('price', {
            header: t('text.columns.price'),
            cell: (props) => (
                <span>
                    {formatAmount(
                        props.row.original.price,
                        props.row.original.currency,
                    )}
                </span>
            ),
        }),
        columnHelper.accessor('qty', {
            header: t('text.columns.quantity'),
            cell: (props) => {
                const row = props.row.original
                return (
                    <Input
                        type="number"
                        min={1}
                        step="1"
                        value={row.qty}
                        onChange={(e) => onQtyChange(row.productId, Number(e.target.value))}
                    />
                )
            },
        }),
        columnHelper.display({
            id: 'total',
            header: t('text.columns.total'),
            cell: (props) => {
                const { price, qty, currency } = props.row.original
                return (
                    <span>
                        {formatAmount(
                            (Number(price) || 0) * (Number(qty) || 0),
                            currency,
                        )}
                    </span>
                )
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: t('text.columns.actions'),
            cell: (props) => {
                const row = props.row.original
                return (
                    <div className="text-right">
                        <Button size="sm" onClick={() => onRemove(row.productId)}>
                            {t('text.actions.remove')}
                        </Button>
                    </div>
                )
            },
        }),
    ]

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <Table>
            <THead>
                {table.getHeaderGroups().map((headerGroup) => (
                    <Tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <Th key={header.id} colSpan={header.colSpan}>
                                {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                )}
                            </Th>
                        ))}
                    </Tr>
                ))}
            </THead>
            <TBody>
                {table.getRowModel().rows.map((row) => (
                    <Tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                            <Td key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Td>
                        ))}
                    </Tr>
                ))}
                {items.length === 0 && (
                    <Tr>
                        <Td colSpan={5}>
                            <div className="text-center py-6 opacity-70">
                                {t('text.placeholders.searchProduct')}
                            </div>
                        </Td>
                    </Tr>
                )}
            </TBody>
        </Table>
    )
}

export default EditableOrderProductsTable
