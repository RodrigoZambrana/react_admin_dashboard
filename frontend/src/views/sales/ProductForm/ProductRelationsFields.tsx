import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { FormItem } from '@/components/ui/Form'
import { HiOutlineArrowDown, HiOutlineArrowUp, HiOutlinePlus, HiOutlineSearch, HiOutlineX } from 'react-icons/hi'
import { apiGetSalesProducts } from '@/services/SalesService'
import type { ProductRelation, ProductRelationType } from './types'

type RelationSearchResult = {
    id: number
    name: string
    productCode?: string | null
    productType?: string | null
}

type Props = {
    value: ProductRelation[]
    onChange: (relations: ProductRelation[]) => void
    currentProductId?: number
}

const relationTypeOrder: ProductRelationType[] = [
    'RELATED',
    'FREQUENTLY_BOUGHT_TOGETHER',
    'SUGGESTED_ADD_ON',
]

const relationTypeMeta: Record<
    ProductRelationType,
    { title: string; description: string; emptyLabel: string }
> = {
    RELATED: {
        title: 'Productos relacionados',
        description: 'Se muestran como sugerencias de navegación relacionadas.',
        emptyLabel: 'No hay productos relacionados configurados.',
    },
    FREQUENTLY_BOUGHT_TOGETHER: {
        title: 'Frequently Bought Together',
        description: 'Agrupa productos que suelen comprarse juntos.',
        emptyLabel: 'Todavía no hay combinaciones frecuentes.',
    },
    SUGGESTED_ADD_ON: {
        title: 'Add-ons sugeridos',
        description: 'Servicios o complementos que conviene ofrecer junto al producto.',
        emptyLabel: 'No hay add-ons sugeridos configurados.',
    },
    INSTALLATION_ADD_ON: {
        title: 'Instalación',
        description: 'Se gestiona automáticamente desde la política de instalación.',
        emptyLabel: 'La instalación se resuelve por la configuración del producto.',
    },
}

const initialQueryState = (): Record<ProductRelationType, string> => ({
    RELATED: '',
    FREQUENTLY_BOUGHT_TOGETHER: '',
    SUGGESTED_ADD_ON: '',
    INSTALLATION_ADD_ON: '',
})

const initialResultState = (): Record<ProductRelationType, RelationSearchResult[]> => ({
    RELATED: [],
    FREQUENTLY_BOUGHT_TOGETHER: [],
    SUGGESTED_ADD_ON: [],
    INSTALLATION_ADD_ON: [],
})

const initialLoadingState = (): Record<ProductRelationType, boolean> => ({
    RELATED: false,
    FREQUENTLY_BOUGHT_TOGETHER: false,
    SUGGESTED_ADD_ON: false,
    INSTALLATION_ADD_ON: false,
})

const buildSearchPayload = (query: string) => ({
    pageIndex: 1,
    pageSize: 8,
    query,
    sort: {
        order: '',
        key: '',
    },
})

const ProductRelationsFields = ({ value, onChange, currentProductId }: Props) => {
    const [searchQueries, setSearchQueries] = useState(initialQueryState)
    const [searchResults, setSearchResults] = useState(initialResultState)
    const [searchLoading, setSearchLoading] = useState(initialLoadingState)

    const groupedRelations = useMemo(() => {
        const map = new Map<ProductRelationType, ProductRelation[]>()
        relationTypeOrder.forEach((type) => {
            map.set(
                type,
                (value || [])
                    .filter((entry) => entry.type === type)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
            )
        })
        return map
    }, [value])

    useEffect(() => {
        const activeRequests = relationTypeOrder
            .map((type) => ({
                type,
                query: searchQueries[type].trim(),
            }))
            .filter((entry) => entry.query.length >= 2)

        if (!activeRequests.length) {
            setSearchResults(initialResultState())
            setSearchLoading(initialLoadingState())
            return
        }

        const timers = activeRequests.map(({ type, query }) =>
            window.setTimeout(async () => {
                setSearchLoading((current) => ({ ...current, [type]: true }))
                try {
                    const response = await apiGetSalesProducts<
                        { data?: RelationSearchResult[] },
                        ReturnType<typeof buildSearchPayload>
                    >(buildSearchPayload(query))
                    const items = Array.isArray(response.data?.data)
                        ? response.data.data
                              .map((entry) => ({
                                  id: Number(entry.id),
                                  name: String(entry.name ?? '').trim(),
                                  productCode:
                                      typeof entry.productCode === 'string'
                                          ? entry.productCode
                                          : null,
                                  productType:
                                      typeof entry.productType === 'string'
                                          ? entry.productType
                                          : null,
                              }))
                              .filter(
                                  (entry) =>
                                      Number.isFinite(entry.id) &&
                                      entry.id > 0 &&
                                      entry.name &&
                                      entry.id !== currentProductId,
                              )
                        : []
                    setSearchResults((current) => ({ ...current, [type]: items }))
                } catch (error) {
                    console.error('product-relations/search', error)
                    setSearchResults((current) => ({ ...current, [type]: [] }))
                } finally {
                    setSearchLoading((current) => ({ ...current, [type]: false }))
                }
            }, 280),
        )

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer))
        }
    }, [currentProductId, searchQueries])

    const updateGroup = (type: ProductRelationType, nextEntries: ProductRelation[]) => {
        const next = [
            ...(value || []).filter((entry) => entry.type !== type),
            ...nextEntries.map((entry, index) => ({
                ...entry,
                type,
                sortOrder: index,
                isActive: entry.isActive !== false,
            })),
        ]
        onChange(next)
    }

    const addRelation = (type: ProductRelationType, entry: RelationSearchResult) => {
        const current = groupedRelations.get(type) ?? []
        if (current.some((item) => item.id === entry.id)) {
            return
        }
        updateGroup(type, [
            ...current,
            {
                id: entry.id,
                type,
                name: entry.name,
                productCode: entry.productCode ?? null,
                productType: entry.productType ?? null,
                isActive: true,
                sortOrder: current.length,
            },
        ])
    }

    const removeRelation = (type: ProductRelationType, productId: number) => {
        const current = groupedRelations.get(type) ?? []
        updateGroup(
            type,
            current.filter((entry) => entry.id !== productId),
        )
    }

    const moveRelation = (type: ProductRelationType, productId: number, direction: -1 | 1) => {
        const current = [...(groupedRelations.get(type) ?? [])]
        const currentIndex = current.findIndex((entry) => entry.id === productId)
        const nextIndex = currentIndex + direction
        if (currentIndex === -1 || nextIndex < 0 || nextIndex >= current.length) {
            return
        }
        const [target] = current.splice(currentIndex, 1)
        current.splice(nextIndex, 0, target)
        updateGroup(type, current)
    }

    return (
        <Card>
            <div className="flex flex-col gap-5">
                <div>
                    <h5 className="mb-1">Relaciones comerciales</h5>
                    <p className="text-sm text-gray-600">
                        Definí productos relacionados, combinaciones frecuentes y add-ons
                        sugeridos. La instalación se sigue resolviendo automáticamente por la
                        política del producto.
                    </p>
                </div>

                {relationTypeOrder.map((type) => {
                    const meta = relationTypeMeta[type]
                    const selectedItems = groupedRelations.get(type) ?? []
                    const query = searchQueries[type]
                    const results = searchResults[type] ?? []
                    const isLoading = searchLoading[type]

                    return (
                        <div key={type} className="rounded-xl border border-gray-200 p-4">
                            <div className="mb-3">
                                <h6 className="mb-1 text-sm font-semibold text-gray-900">
                                    {meta.title}
                                </h6>
                                <p className="text-xs text-gray-600">{meta.description}</p>
                            </div>

                            <FormItem
                                label="Buscar productos"
                                className="mb-3"
                                extra="Escribí al menos 2 caracteres para buscar y sumar al grupo."
                            >
                                <Input
                                    prefix={<HiOutlineSearch className="text-lg text-gray-500" />}
                                    value={query}
                                    onChange={(event) =>
                                        setSearchQueries((current) => ({
                                            ...current,
                                            [type]: event.target.value,
                                        }))
                                    }
                                    placeholder="Nombre o código de producto"
                                />
                            </FormItem>

                            {query.trim().length >= 2 ? (
                                <div className="mb-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-3">
                                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                                        Resultados
                                    </div>
                                    {isLoading ? (
                                        <div className="text-sm text-gray-500">Buscando…</div>
                                    ) : results.length ? (
                                        <div className="flex flex-col gap-2">
                                            {results.map((entry) => {
                                                const alreadyAdded = selectedItems.some(
                                                    (item) => item.id === entry.id,
                                                )
                                                return (
                                                    <div
                                                        key={`${type}-${entry.id}`}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-gray-900">
                                                                {entry.name}
                                                            </div>
                                                            <div className="truncate text-xs text-gray-500">
                                                                {entry.productCode || 'Sin código'}
                                                                {entry.productType
                                                                    ? ` · ${entry.productType}`
                                                                    : ''}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="xs"
                                                            type="button"
                                                            variant="solid"
                                                            disabled={alreadyAdded}
                                                            icon={<HiOutlinePlus />}
                                                            onClick={() => addRelation(type, entry)}
                                                        >
                                                            {alreadyAdded ? 'Agregado' : 'Agregar'}
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500">
                                            No se encontraron productos para esa búsqueda.
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="flex flex-col gap-2">
                                {selectedItems.length ? (
                                    selectedItems.map((entry, index) => (
                                        <div
                                            key={`${type}-${entry.id}`}
                                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-gray-900">
                                                    {entry.name || `Producto #${entry.id}`}
                                                </div>
                                                <div className="truncate text-xs text-gray-500">
                                                    {entry.productCode || 'Sin código'}
                                                    {entry.productType ? ` · ${entry.productType}` : ''}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="xs"
                                                    type="button"
                                                    variant="plain"
                                                    disabled={index === 0}
                                                    icon={<HiOutlineArrowUp />}
                                                    onClick={() => moveRelation(type, entry.id, -1)}
                                                />
                                                <Button
                                                    size="xs"
                                                    type="button"
                                                    variant="plain"
                                                    disabled={index === selectedItems.length - 1}
                                                    icon={<HiOutlineArrowDown />}
                                                    onClick={() => moveRelation(type, entry.id, 1)}
                                                />
                                                <Button
                                                    size="xs"
                                                    type="button"
                                                    variant="plain"
                                                    className="text-red-600"
                                                    icon={<HiOutlineX />}
                                                    onClick={() => removeRelation(type, entry.id)}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
                                        {meta.emptyLabel}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}

export default ProductRelationsFields
