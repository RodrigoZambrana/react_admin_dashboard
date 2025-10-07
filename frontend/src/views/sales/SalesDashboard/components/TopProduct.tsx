import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table'
import { FiPackage } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Product = {
    id: string
    name: string
    img: string
    sold: number
}

type TopProductProps = {
    data?: Product[]
    className?: string
}

const { Tr, Td, TBody, THead, Th } = Table

const ProductColumn = ({ row }: { row: Product }) => {
    const avatar = row.img ? (
        <Avatar src={row.img} />
    ) : (
        <Avatar icon={<FiPackage />} />
    )

    return (
        <div className="flex items-center gap-2">
            {avatar}
            <span className="font-semibold">{row.name}</span>
        </div>
    )
}

const columnHelper = createColumnHelper<Product>()

const columns = (t: (k: string) => string) => [
    columnHelper.accessor('name', {
        header: t('text.columns.product'),
        cell: (props) => {
            const row = props.row.original
            return <ProductColumn row={row} />
        },
    }),
    columnHelper.accessor('sold', {
        header: t('text.columns.sold'),
    }),
]

const TopProduct = ({ data = [], className }: TopProductProps) => {
    const { t } = useTranslation()
    const table = useReactTable({
        data,
        columns: columns(t),
        getCoreRowModel: getCoreRowModel(),
    })

    const navigate = useNavigate()

    return (
        <Card className={className}>
            <div className="flex items-center justify-between mb-4">
                <h4>{t('sales.dashboard.topProduct.title')}</h4>
                <Button size="sm" onClick={() => navigate('/app/products/list')}>
                    {t('sales.dashboard.topProduct.viewProducts')}
                </Button>
            </div>
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
        </Card>
    )
}

export default TopProduct
