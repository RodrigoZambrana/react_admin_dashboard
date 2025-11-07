import type { ParametricConfigSnapshot, ParametricQuoteResult } from './ParametricConfigurator'

type UrucortinasMatrixRow = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    priceBase: number
    priceMosquitero?: number | null
    priceMonoblock?: number | null
    priceMonoblockMosquitero?: number | null
    hasMosquiteroOption: boolean
    hasMonoblockOption: boolean
    currency: string
    shutterMaterial?: string
    referenceDate?: string | null
    specifications?: string | null
    source?: string | null
}

const OPENING_TYPES = [
    'CORREDIZA',
    'CORREDIZA 2H 2G',
    'CORREDIZA 2H2G + PAÑO FIJO',
    'PAÑO FIJO CON U INFERIOR /LATERAL Y SUP',
    'PUERTA BLINDEX  2  HOJAS',
    'BLINDEX',
    'CORREDIZA 2H2G + CORREDIZA 2H2G',
    'PUERTA +  PAÑO FIJO +  PAÑO FIJO',
    'CORREDIZA 3H 3G',
    'CORREDIZA 3H 3G + PAÑO FIJO',
    'CORREDIZA 2H2G + PAÑO FIJO + PAÑO FIJO',
    'PAÑO FIJO + PROYECTANTE + PROYECTANTE',
    'CORREDIZA 3H 2G',
    'CORREDIZA 4H 4G',
    'PROYECTANTE',
    'PROYECTANTE + PAÑO FIJO',
    'PROYECCION Y DESLIZ',
    '2 OSCILOBATIENTES + PAÑO FIJO',
    'TABAQUERA + PAÑO FIJO',
    'TABAQUERA',
    'BATIENTE 1H',
    'BATIENTE 2H',
    'OSCILOBATIENTE',
    'OSCILOBATIENTE  +  PAÑO FIJO',
    'PAÑO FIJO + PAÑO FIJO',
    'PAÑO FIJO',
    'BATIENTE 1H + PAÑO FIJO',
    'TUBULAR',
    'PUERTA BATIENTE 1H',
    'PUERTA BATIENTE 2H',
    'CELOSIA',
    'TAPAJUNTAS',
    'PREMARCO',
    'OTROS',
    'LUCERNARIO',
    'BARANDA',
]

const SERIES = ['LP', 'S20', 'S25', 'S30', 'PROBBA', 'GALA 45', 'GALA CR', 'SUMMA', 'OTROS']

const COLORS = ['NATURAL', 'BLANCO', 'MARRON', 'MADERA', 'ANOLOK', 'NEGRO']

const GLASS_TYPES = ['3MM', '4MM', '5MM', '6MM', 'DVH (4/9/5)', 'DVH (5/9/6)']

const DEFAULT_MATRIX_ROWS: UrucortinasMatrixRow[] = [
    {
        familyId: 'CORREDIZA',
        serie: 'S20',
        color: 'BLANCO',
        vidrio: '4MM',
        widthMm: 600,
        heightMm: 600,
        priceBase: 80,
        priceMosquitero: 110,
        priceMonoblock: 180,
        priceMonoblockMosquitero: 210,
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
        currency: 'USD',
        shutterMaterial: 'PVC',
        referenceDate: '2025-02-01',
        specifications: 'CORREDIZA S20 Blanco 4MM 600x600',
        source: 'LISTA DE PRECIOS LIDASUR 2025-02',
    },
    {
        familyId: 'CORREDIZA 2H 2G',
        serie: 'S20',
        color: 'NEGRO',
        vidrio: '4MM',
        widthMm: 800,
        heightMm: 600,
        priceBase: 92,
        priceMosquitero: 122,
        priceMonoblock: 190,
        priceMonoblockMosquitero: 220,
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
        currency: 'USD',
        shutterMaterial: 'PVC',
        referenceDate: '2025-02-01',
        specifications: 'CORREDIZA 2H 2G S20 Negro 4MM 800x600',
        source: 'LISTA DE PRECIOS LIDASUR 2025-02',
    },
    {
        familyId: 'PAÑO FIJO',
        serie: 'LP',
        color: 'BLANCO',
        vidrio: '4MM',
        widthMm: 1000,
        heightMm: 1000,
        priceBase: 88,
        priceMosquitero: null,
        priceMonoblock: null,
        priceMonoblockMosquitero: null,
        hasMosquiteroOption: false,
        hasMonoblockOption: false,
        currency: 'USD',
        shutterMaterial: '',
        referenceDate: '2022-06-01',
        specifications: 'PAÑO FIJO LP Blanco 4MM 1000x1000',
        source: 'LISTA DE PRECIOS LIDASUR 2022-06',
    },
    {
        familyId: 'PUERTA BATIENTE 1H',
        serie: 'PROBBA',
        color: 'MADERA',
        vidrio: 'DVH (4/9/5)',
        widthMm: 900,
        heightMm: 2100,
        priceBase: 210,
        priceMosquitero: null,
        priceMonoblock: 260,
        priceMonoblockMosquitero: null,
        hasMosquiteroOption: false,
        hasMonoblockOption: true,
        currency: 'USD',
        shutterMaterial: 'ALUMINIO',
        referenceDate: '2025-01-31',
        specifications: 'PUERTA BATIENTE 1H PROBBA Madera DVH 900x2100',
        source: 'PROMPT INTERNO 2025-01',
    },
]

const DEFAULT_MATRIX_HEADER =
    'family_id,serie,color,vidrio,width_mm,height_mm,price_base,price_mosquitero,price_pvc_shutter,price_pvc_shutter_mosq,price_aluminio_shutter,price_aluminio_shutter_mosq,currency,source,reference_date,specifications'

const formatMatrixPrice = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
        return '0'
    }
    return Number(value).toFixed(2)
}

const DEFAULT_MATRIX_CSV =
    `${DEFAULT_MATRIX_HEADER}\n` +
    DEFAULT_MATRIX_ROWS.map((row) => {
        const material = (row.shutterMaterial ?? '').trim().toUpperCase()
        const pvcShutter = material === 'PVC' ? row.priceMonoblock : null
        const pvcShutterMosq = material === 'PVC' ? row.priceMonoblockMosquitero : null
        const aluShutter = material === 'ALUMINIO' ? row.priceMonoblock : null
        const aluShutterMosq = material === 'ALUMINIO' ? row.priceMonoblockMosquitero : null
        return [
            row.familyId,
            row.serie ?? '',
            row.color,
            row.vidrio,
            row.widthMm,
            row.heightMm,
            formatMatrixPrice(row.priceBase),
            formatMatrixPrice(row.priceMosquitero ?? null),
            formatMatrixPrice(pvcShutter),
            formatMatrixPrice(pvcShutterMosq),
            formatMatrixPrice(aluShutter),
            formatMatrixPrice(aluShutterMosq),
            row.currency,
            row.source ?? '',
            row.referenceDate ?? '',
            row.specifications ?? '',
        ].join(',')
    }).join('\n')

const DEFAULT_SNAPSHOT: ParametricConfigSnapshot = {
    selectors: {
        families: OPENING_TYPES,
        series: SERIES,
        materials: ['ALUMINIO'],
        colors: COLORS,
        glass: GLASS_TYPES,
        widths: Array.from(new Set(DEFAULT_MATRIX_ROWS.map((row) => row.widthMm))).sort((a, b) => a - b),
        heights: Array.from(new Set(DEFAULT_MATRIX_ROWS.map((row) => row.heightMm))).sort((a, b) => a - b),
        shutterMaterials: ['PVC', 'ALUMINIO', ''],
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
    },
    stats: {
        rowCount: DEFAULT_MATRIX_ROWS.length,
        minimumPrice: Math.min(...DEFAULT_MATRIX_ROWS.map((row) => row.priceBase)),
        currency: 'USD',
        newestReferenceDate: '2025-02-01',
        oldestReferenceDate: '2022-06-01',
    },
    compatibility: {
        glassBySeries: SERIES.reduce<Record<string, string[]>>((acc, serie) => {
            acc[serie] = GLASS_TYPES
            return acc
        }, {}),
        monoblockBySeries: SERIES.reduce<Record<string, boolean>>((acc, serie) => {
            acc[serie] = !['LP', 'OTROS'].includes(serie)
            return acc
        }, {}),
    },
}

export const getUrucortinasDefaultSnapshot = (): ParametricConfigSnapshot =>
    JSON.parse(JSON.stringify(DEFAULT_SNAPSHOT))

export const createUrucortinasDefaultMatrixFile = (): File | null => {
    if (typeof window === 'undefined' || typeof File === 'undefined') {
        return null
    }
    return new File([DEFAULT_MATRIX_CSV], 'aberturas-parametric-default.csv', {
        type: 'text/csv',
    })
}

type QuoteInput = {
    familyId: string
    serie: string
    color: string
    vidrio: string
    widthMm: number
    heightMm: number
    hasMosquitero: boolean
    hasShutterMonoblock: boolean
}

const normalizeValue = (value: number | undefined | null) => {
    if (value === undefined || value === null) {
        return null
    }
    return Number(value.toFixed(4))
}

export const quoteUrucortinasMatrix = (input: QuoteInput): ParametricQuoteResult => {
    const row = DEFAULT_MATRIX_ROWS.find(
        (candidate) =>
            candidate.familyId === input.familyId &&
            candidate.serie === input.serie &&
            candidate.color === input.color &&
            candidate.vidrio === input.vidrio &&
            candidate.widthMm === input.widthMm &&
            candidate.heightMm === input.heightMm,
    )

    const requested = {
        familyId: input.familyId,
        serie: input.serie,
        material: 'ALUMINIO',
        color: input.color,
        vidrio: input.vidrio,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        hasMosquitero: input.hasMosquitero,
        hasShutterMonoblock: input.hasShutterMonoblock,
        shutterMaterial: row?.shutterMaterial ?? '',
    }

    if (!row) {
        return {
            productId: 0,
            available: false,
            requested,
        }
    }

    requested.shutterMaterial = row.shutterMaterial ?? ''

    if (input.hasMosquitero && !row.hasMosquiteroOption) {
        return {
            productId: 0,
            available: false,
            requested,
        }
    }

    if (input.hasShutterMonoblock && !row.hasMonoblockOption) {
        return {
            productId: 0,
            available: false,
            requested,
        }
    }

    const basePrice = normalizeValue(row.priceBase)
    const mosqPrice = normalizeValue(row.priceMosquitero ?? null)
    const monoblockPrice = normalizeValue(row.priceMonoblock ?? null)
    const combinedPrice = normalizeValue(row.priceMonoblockMosquitero ?? null)

    let finalPrice = basePrice

    if (input.hasShutterMonoblock && input.hasMosquitero) {
        if (combinedPrice && combinedPrice > 0) {
            finalPrice = combinedPrice
        } else if (mosqPrice && monoblockPrice) {
            const deltaMosq = mosqPrice - (basePrice ?? 0)
            const deltaMonoblock = monoblockPrice - (basePrice ?? 0)
            finalPrice = normalizeValue((basePrice ?? 0) + deltaMosq + deltaMonoblock)
        } else {
            finalPrice = null
        }
    } else if (input.hasShutterMonoblock) {
        finalPrice = monoblockPrice
    } else if (input.hasMosquitero) {
        finalPrice = mosqPrice
    }

    if (!finalPrice || finalPrice <= 0) {
        return {
            productId: 0,
            available: false,
            requested,
        }
    }

    const specifications = row.specifications ?? null
    return {
        productId: 0,
        available: true,
        price: finalPrice,
        currency: row.currency,
        detailSnapshot: specifications,
        specifications,
        source: row.source ?? null,
        referenceDate: row.referenceDate ?? null,
        requested,
        matrixRowId: 0,
    }
}
