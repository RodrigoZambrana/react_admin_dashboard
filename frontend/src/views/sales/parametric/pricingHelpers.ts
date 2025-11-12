export type ShutterKind = 'none' | 'pvc' | 'aluminio'

export interface ProductRow {
    price_base: number
    price_mosquitero: number
    price_pvc_shutter: number
    price_pvc_shutter_mosq: number
    price_aluminio_shutter: number
    price_aluminio_shutter_mosq: number
}

export interface Selection {
    mosquitero: boolean
    shutter: ShutterKind
    shutterMosquitero: boolean
}

export interface PriceResult {
    available: boolean
    cost: number
    sale: number
    usedColumn:
        | 'price_base'
        | 'price_mosquitero'
        | 'price_pvc_shutter'
        | 'price_pvc_shutter_mosq'
        | 'price_aluminio_shutter'
        | 'price_aluminio_shutter_mosq'
        | null
}

export function mapSelectionToColumn(sel: Selection): keyof ProductRow | null {
    if (sel.shutter === 'none') {
        return sel.mosquitero ? 'price_mosquitero' : 'price_base'
    }
    if (sel.shutter === 'pvc') {
        return sel.shutterMosquitero ? 'price_pvc_shutter_mosq' : 'price_pvc_shutter'
    }
    if (sel.shutter === 'aluminio') {
        return sel.shutterMosquitero ? 'price_aluminio_shutter_mosq' : 'price_aluminio_shutter'
    }
    return null
}

export function computePrice(row: ProductRow, sel: Selection, marginPercent: number): PriceResult {
    const col = mapSelectionToColumn(sel)
    if (!col) {
        return { available: false, cost: 0, sale: 0, usedColumn: null }
    }

    const costRaw = row[col] ?? 0
    const available = costRaw > 0

    const cost = available ? Math.round(costRaw * 100) / 100 : 0
    const factor = 1 + (marginPercent || 0) / 100
    const saleRaw = available ? cost * factor : 0
    const sale = available ? Math.ceil(saleRaw - 1e-9) : 0

    return { available, cost, sale, usedColumn: col }
}

export function getAllowedStates(row: ProductRow) {
    const hasBase = row.price_base > 0
    const hasMosqOnly = row.price_mosquitero > 0

    const hasPvc = row.price_pvc_shutter > 0
    const hasPvcMosq = row.price_pvc_shutter_mosq > 0

    const hasAlu = row.price_aluminio_shutter > 0
    const hasAluMosq = row.price_aluminio_shutter_mosq > 0

    return {
        base: hasBase,
        mosqOnly: hasMosqOnly,
        pvcOnly: hasPvc,
        pvcMosq: hasPvcMosq,
        aluOnly: hasAlu,
        aluMosq: hasAluMosq,
        canToggleMosqForPVC: hasPvc || hasPvcMosq,
        canToggleMosqForALU: hasAlu || hasAluMosq,
    }
}

export function normalizeSelectionByAvailability(row: ProductRow, sel: Selection): Selection {
    const allow = getAllowedStates(row)

    if (sel.shutter === 'none') {
        if (sel.mosquitero && !allow.mosqOnly) {
            sel = { ...sel, mosquitero: false }
        }
        if (!allow.base && allow.mosqOnly) {
            sel = { ...sel, mosquitero: true }
        }
        return sel
    }

    if (sel.shutter === 'pvc') {
        if (!allow.pvcOnly && allow.pvcMosq) {
            sel = { ...sel, shutterMosquitero: true }
        }
        if (!allow.pvcOnly && !allow.pvcMosq) {
            sel = { ...sel, shutter: 'none', shutterMosquitero: false }
        }
        return sel
    }

    if (sel.shutter === 'aluminio') {
        if (!allow.aluOnly && allow.aluMosq) {
            sel = { ...sel, shutterMosquitero: true }
        }
        if (!allow.aluOnly && !allow.aluMosq) {
            sel = { ...sel, shutter: 'none', shutterMosquitero: false }
        }
        return sel
    }

    return sel
}
