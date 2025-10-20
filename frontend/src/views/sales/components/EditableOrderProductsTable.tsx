import { useTranslation } from 'react-i18next'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import { useEffect, useRef, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { useAppSelector } from '@/store'
import { formatCurrency, normalizeCurrencyCode } from '@/utils/currency'
import { HiOutlineCheck, HiOutlinePencil } from 'react-icons/hi'
import classNames from 'classnames'
import { resolveTextDirection } from '@/utils/textDirection'

export type EditableItem = {
    productId: string
    name: string
    price: number
    qty: number
    img?: string
    description?: string
    currency?: string
    unitPrice?: number
    unitCurrency?: string
    comments?: string
}

type Props = {
    items: EditableItem[]
    onQtyChange: (productId: string, qty: number) => void
    onRemove: (productId: string) => void
    showDescription?: boolean
    showImage?: boolean
    showComments?: boolean
    onCommentChange?: (productId: string, comments: string) => void
}

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<EditableItem>()

const stripHtml = (html?: string) =>
    (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const ProductCell = ({
    row,
    showDescription,
    showImage,
}: {
    row: EditableItem
    showDescription?: boolean
    showImage?: boolean
}) => {
    const text = stripHtml(row.description)
    const excerpt = text.length > 120 ? text.slice(0, 120) + '…' : text
    const shouldShowImage = Boolean(showImage && row.img)
    const containerClass = shouldShowImage ? 'flex' : ''
    return (
        <div className={containerClass}>
            {shouldShowImage && (
                <Avatar size={90} src={row.img} />
            )}
            <div className={shouldShowImage ? 'ltr:ml-3 rtl:mr-3' : ''}>
                <h6 className="mb-1 font-semibold leading-tight">{row.name}</h6>
                {showDescription && excerpt && (
                    <div className="text-sm opacity-80 leading-snug">{excerpt}</div>
                )}
            </div>
        </div>
    )
}

const EditableOrderProductsTable = ({
    items,
    onQtyChange,
    onRemove,
    showDescription = true,
    showImage = true,
    showComments = false,
    onCommentChange,
}: Props) => {
    const { t, i18n } = useTranslation()
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
    const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
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
                return (
                    <ProductCell
                        row={row}
                        showDescription={showDescription}
                        showImage={showImage}
                    />
                )
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

    if (showComments) {
        columns.splice(
            3,
            0,
            columnHelper.display({
                id: 'comments',
                header: t('text.columns.comments'),
                cell: (props) => {
                    const row = props.row.original
                    if (!onCommentChange) {
                        return (
                            <span
                                className="block min-h-[2.25rem] whitespace-pre-wrap"
                                dir={resolveTextDirection(row.comments)}
                            >
                                {row.comments?.trim?.() ? row.comments : '—'}
                            </span>
                        )
                    }
                    const isEditing = editingCommentId === row.productId
                    const draftValue =
                        commentDrafts[row.productId] ?? row.comments ?? ''
                    const originalValue = row.comments ?? ''
                    const hasChanges = draftValue !== originalValue
                    const closeEditor = () => {
                        setEditingCommentId(null)
                        setCommentDrafts((prev) => {
                            const next = { ...prev }
                            delete next[row.productId]
                            return next
                        })
                        delete textAreaRefs.current[row.productId]
                    }
                    const handleSave = () => {
                        if (!hasChanges) {
                            closeEditor()
                            return
                        }
                        onCommentChange(row.productId, draftValue)
                        closeEditor()
                    }
                    if (!isEditing) {
                        const hasComment = Boolean(row.comments?.trim?.())
                        const displayText = hasComment
                            ? row.comments
                            : t('text.labels.notAvailable', {
                                  defaultValue: 'Not available',
                              })
                        const displayDir = resolveTextDirection(row.comments)
                        const displayClass = classNames(
                            'block min-h-[2.25rem] whitespace-pre-wrap text-sm flex-1',
                            hasComment
                                ? 'text-gray-700 dark:text-gray-200'
                                : 'text-gray-400 italic',
                        )
                        return (
                            <div className="flex items-start gap-2">
                                <span className={displayClass} dir={displayDir}>
                                    {displayText}
                                </span>
                                <Button
                                    size="sm"
                                    variant="plain"
                                    shape="circle"
                                    icon={<HiOutlinePencil />}
                                    type="button"
                                    className="shrink-0"
                                    aria-label={t('text.actions.edit')}
                                    title={t('text.actions.edit')}
                                    onClick={() => {
                                        setEditingCommentId(row.productId)
                                        setCommentDrafts((prev) => ({
                                            ...prev,
                                            [row.productId]: row.comments ?? '',
                                        }))
                                    }}
                                />
                            </div>
                        )
                    }
                    return (
                        <div className="flex items-start gap-2">
                            <Textarea
                                value={draftValue}
                                className="w-full"
                                ref={(node) => {
                                    textAreaRefs.current[row.productId] =
                                        (node as HTMLTextAreaElement | null) ?? null
                                }}
                                autoFocus
                                placeholder={t('text.placeholders.enterComment', {
                                    defaultValue: 'Add a note for this product',
                                })}
                                onChange={(e) =>
                                    setCommentDrafts((prev) => ({
                                        ...prev,
                                        [row.productId]: e.target.value,
                                    }))
                                }
                                dir={resolveTextDirection(draftValue)}
                                rows={4}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault()
                                        closeEditor()
                                    }
                                }}
                            />
                            <Button
                                size="sm"
                                variant="plain"
                                shape="circle"
                                icon={<HiOutlineCheck />}
                                type="button"
                                className="shrink-0 mt-1.5"
                                aria-label={t('text.actions.save')}
                                title={t('text.actions.save')}
                                onClick={handleSave}
                            />
                        </div>
                    )
                },
            }),
        )
    }

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    useEffect(() => {
        if (!editingCommentId) {
            return
        }
        const node = textAreaRefs.current[editingCommentId]
        if (node) {
            node.focus()
            const length = node.value.length
            node.setSelectionRange(length, length)
        }
    }, [editingCommentId, commentDrafts])

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
                        <Td colSpan={table.getAllColumns().length}>
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
