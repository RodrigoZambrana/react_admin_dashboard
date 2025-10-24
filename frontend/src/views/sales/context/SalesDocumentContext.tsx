import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { SalesDocumentResource } from '@/services/SalesService'

export type SalesDocumentMode = 'order' | 'budget'
export type SalesDocumentLayoutMode = 'default' | 'itemsOnly'

type SalesDocumentRoutes = {
    list: string
    create: string
    edit: string
    details: string
    invoice: string
}

type SalesDocumentDefaults = Record<string, string>
interface SalesDocumentOverrides {
    customerRequired?: boolean
    layoutMode?: SalesDocumentLayoutMode
    defaults?: Partial<SalesDocumentDefaults>
    showProductSpecifications?: boolean
    showPaymentMethodSelect?: boolean
}

export interface SalesDocumentConfig {
    mode: SalesDocumentMode
    resource: SalesDocumentResource
    translationBase: string
    documentLabel: string
    routes: SalesDocumentRoutes
    defaults: SalesDocumentDefaults
    customerRequired: boolean
    layoutMode: SalesDocumentLayoutMode
    showProductSpecifications: boolean
    showPaymentMethodSelect: boolean
}

const ORDER_DEFAULTS: SalesDocumentDefaults = {
    title: 'Pedidos confirmados',
    addAction: 'Agregar Pedido',
    detailsTitle: 'Detalle del pedido',
    invoiceAction: 'Factura',
    listNavLabel: 'Lista de pedidos',
}

const BUDGET_DEFAULTS: SalesDocumentDefaults = {
    title: 'Presupuestos',
    addAction: 'Crear presupuesto',
    detailsTitle: 'Detalle del presupuesto',
    invoiceAction: 'Documento',
    listNavLabel: 'Lista de presupuestos',
}

const buildConfig = (mode: SalesDocumentMode): SalesDocumentConfig => {
    if (mode === 'budget') {
        return {
            mode,
            resource: 'budgets',
            translationBase: 'sales.budgets',
            documentLabel: 'budget',
            routes: {
                list: '/app/sales/budget-list',
                create: '/app/sales/budget-new',
                edit: '/app/sales/budget-edit',
                details: '/app/sales/budget-details',
                invoice: '/app/sales/budget-document',
            },
            defaults: BUDGET_DEFAULTS,
            customerRequired: true,
            layoutMode: 'default',
            showProductSpecifications: true,
            showPaymentMethodSelect: true,
        }
    }
    return {
        mode: 'order',
        resource: 'orders',
        translationBase: 'sales.orders',
        documentLabel: 'order',
        routes: {
            list: '/app/sales/order-list',
            create: '/app/sales/order-new',
            edit: '/app/sales/order-edit',
            details: '/app/sales/order-details',
            invoice: '/app/account/invoice',
        },
        defaults: ORDER_DEFAULTS,
        customerRequired: true,
        layoutMode: 'default',
        showProductSpecifications: true,
        showPaymentMethodSelect: true,
    }
}

const SalesDocumentContext = createContext<SalesDocumentConfig>(buildConfig('order'))

export const SalesDocumentProvider = ({
    mode,
    overrides,
    children,
}: {
    mode: SalesDocumentMode
    overrides?: SalesDocumentOverrides
    children: ReactNode
}) => {
    const value = useMemo(() => {
        const base = buildConfig(mode)
        if (!overrides) {
            return base
        }
        const { defaults: defaultsOverride, ...restOverrides } = overrides
        const merged = {
            ...base,
            ...restOverrides,
        } as SalesDocumentConfig
        if (defaultsOverride) {
            merged.defaults = {
                ...base.defaults,
                ...defaultsOverride,
            }
        }
        return merged
    }, [mode, overrides])
    return (
        <SalesDocumentContext.Provider value={value}>
            {children}
        </SalesDocumentContext.Provider>
    )
}

export const useSalesDocument = () => useContext(SalesDocumentContext)
