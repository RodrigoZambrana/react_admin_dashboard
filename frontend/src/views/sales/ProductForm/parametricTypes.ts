export type ParametricManualConfigDraft = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: string
    heightMm: string
    hasMosquitero: boolean
    hasMonoblock: boolean
    priceBase: string
    priceMosquitero: string
    pricePvcShutter: string
    pricePvcShutterMosq: string
    priceAluminioShutter: string
    priceAluminioShutterMosq: string
}

export type ParametricConfiguratorDraft = {
    matrixFile?: File | Blob | null
    manualConfig?: ParametricManualConfigDraft | null
}

export type ParametricManualConfigResponse = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    hasMosquitero: boolean
    hasMonoblock: boolean
    currency: string
    priceBase?: number | null
    priceMosquitero?: number | null
    pricePvcShutter?: number | null
    pricePvcShutterMosq?: number | null
    priceAluminioShutter?: number | null
    priceAluminioShutterMosq?: number | null
}

export type ParametricManualConfigPayload = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    hasMosquitero: boolean
    hasMonoblock: boolean
    currency?: string
    priceBase?: number | null
    priceMosquitero?: number | null
    pricePvcShutter?: number | null
    pricePvcShutterMosq?: number | null
    priceAluminioShutter?: number | null
    priceAluminioShutterMosq?: number | null
}

export const createEmptyManualConfigDraft = (): ParametricManualConfigDraft => ({
    familyId: '',
    serie: '',
    color: '',
    vidrio: '',
    widthMm: '',
    heightMm: '',
    hasMosquitero: false,
    hasMonoblock: false,
    priceBase: '',
    priceMosquitero: '',
    pricePvcShutter: '',
    pricePvcShutterMosq: '',
    priceAluminioShutter: '',
    priceAluminioShutterMosq: '',
})

const toNumberOrNull = (value: string): number | null => {
    if (typeof value !== 'string') {
        return null
    }
    const trimmed = value.trim()
    if (!trimmed) {
        return null
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
        return null
    }
    return parsed
}

export const hasManualConfigValues = (draft?: ParametricManualConfigDraft | null): boolean => {
    if (!draft) {
        return false
    }
    const priceFields = [
        draft.priceBase,
        draft.priceMosquitero,
        draft.pricePvcShutter,
        draft.pricePvcShutterMosq,
        draft.priceAluminioShutter,
        draft.priceAluminioShutterMosq,
    ]
    return priceFields.some((value) => {
        const numeric = toNumberOrNull(value)
        return typeof numeric === 'number' && numeric > 0
    })
}

export const mapDraftToManualPayload = (
    draft: ParametricManualConfigDraft,
    currency?: string,
): ParametricManualConfigPayload => {
    const sanitize = (value: string) => value.trim()
    const ensureNumber = (value: string, fallback = 0) => {
        const numeric = toNumberOrNull(value)
        if (numeric === null) {
            return fallback
        }
        return numeric
    }

    return {
        familyId: sanitize(draft.familyId),
        serie: sanitize(draft.serie),
        color: sanitize(draft.color),
        vidrio: sanitize(draft.vidrio),
        widthMm: ensureNumber(draft.widthMm),
        heightMm: ensureNumber(draft.heightMm),
        hasMosquitero: draft.hasMosquitero,
        hasMonoblock: draft.hasMonoblock,
        currency,
        priceBase: toNumberOrNull(draft.priceBase),
        priceMosquitero: toNumberOrNull(draft.priceMosquitero),
        pricePvcShutter: toNumberOrNull(draft.pricePvcShutter),
        pricePvcShutterMosq: toNumberOrNull(draft.pricePvcShutterMosq),
        priceAluminioShutter: toNumberOrNull(draft.priceAluminioShutter),
        priceAluminioShutterMosq: toNumberOrNull(draft.priceAluminioShutterMosq),
    }
}

const trimValue = (value?: string | null) => (typeof value === 'string' ? value.trim() : '')

export const mapManualConfigResponseToDraft = (
    snapshot: ParametricManualConfigResponse,
): ParametricManualConfigDraft => {
    const stringify = (value?: number | null) =>
        typeof value === 'number' && Number.isFinite(value) ? value.toString() : ''

    return {
        familyId: trimValue(snapshot.familyId),
        serie: trimValue(snapshot.serie),
        color: trimValue(snapshot.color),
        vidrio: trimValue(snapshot.vidrio),
        widthMm: String(snapshot.widthMm ?? ''),
        heightMm: String(snapshot.heightMm ?? ''),
        hasMosquitero: Boolean(snapshot.hasMosquitero),
        hasMonoblock: Boolean(snapshot.hasMonoblock),
        priceBase: stringify(snapshot.priceBase),
        priceMosquitero: stringify(snapshot.priceMosquitero),
        pricePvcShutter: stringify(snapshot.pricePvcShutter),
        pricePvcShutterMosq: stringify(snapshot.pricePvcShutterMosq),
        priceAluminioShutter: stringify(snapshot.priceAluminioShutter),
        priceAluminioShutterMosq: stringify(snapshot.priceAluminioShutterMosq),
    }
}
