import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { NumericFormat } from 'react-number-format'
import isLastChild from '@/utils/isLastChild'
import { Link } from 'react-router-dom'
import Tooltip from '@/components/ui/Tooltip'
import { HiOutlineEye } from 'react-icons/hi'

type Product = {
    id: string
    productId?: string
    name: string
    productCode: string
    img: string
    price: number
    quantity: number
    total: number
    details: Record<string, string[]>
}

type OrderProductsProps = {
    data?: Product[]
}

const { Tr, Th, Td, THead, TBody } = Table

const columnHelper = createColumnHelper<Product>()

const ProductColumn = ({ row }: { row: Product }) => {
    return (
        <div className="flex">
            <Avatar size={90} src={row.img} />
            <div className="ltr:ml-2 rtl:mr-2">
                <h6 className="mb-1">{row.name}</h6>
                {Object.keys(row.details).map((key, i) => (
                    <div key={key + i} className="mb-1">
                        <span className="capitalize">{key}: </span>
                        {row.details[key].map((item, j) => (
                            <Fragment key={item + j}>
                                <span className="font-semibold">{item}</span>
                                {!isLastChild(row.details[key], j) && (
                                    <span>, </span>
                                )}
                            </Fragment>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

const PriceAmount = ({ amount }: { amount: number }) => {
    return (
        <NumericFormat
            displayType="text"
            value={(Math.round(amount * 100) / 100).toFixed(2)}
            prefix={'$'}
            thousandSeparator={true}
        />
    )
}

const columns = (t: (k: string) => string) => [
    columnHelper.accessor('name', {
        header: t('text.columns.product'),
        cell: (props) => {
            const row = props.row.original
            return <ProductColumn row={row} />
        },
    }),
    columnHelper.accessor('price', {
        header: t('text.columns.price'),
        cell: (props) => {
            const row = props.row.original
            return <PriceAmount amount={row.price} />
        },
    }),
    columnHelper.accessor('quantity', {
        header: t('text.columns.quantity'),
    }),
    columnHelper.accessor('total', {
        header: t('text.columns.total'),
        cell: (props) => {
            const row = props.row.original
            return <PriceAmount amount={row.total} />
        },
    }),
    columnHelper.display({
        id: 'actions',
        header: '',
        cell: (props) => {
            const row = props.row.original
            if (!row.productId) return null
            return (
                <div className="flex justify-end text-lg">
                    <Tooltip title={t('text.actions.view')}>
                        <Link
                            to={`/app/products/edit/${row.productId}`}
                            className="p-2 text-indigo-600 hover:text-indigo-500"
                        >
                            <HiOutlineEye />
                        </Link>
                    </Tooltip>
                </div>
            )
        },
    }),
]

const OrderProducts = ({ data = [] }: OrderProductsProps) => {
    const { t } = useTranslation()
    const table = useReactTable({
        data,
        columns: columns(t),
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <AdaptableCard className="mb-4">
            <Table>
                <THead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <Th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
                                    </Th>
                                )
                            })}
                        </Tr>
                    ))}
                </THead>
                <TBody>
                    {table.getRowModel().rows.map((row) => {
                        return (
                            <Tr key={row.id}>
                                {row.getVisibleCells().map((cell) => {
                                    return (
                                        <Td key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </Td>
                                    )
                                })}
                            </Tr>
                        )
                    })}
                </TBody>
            </Table>
        </AdaptableCard>
    )
}

export default OrderProducts
