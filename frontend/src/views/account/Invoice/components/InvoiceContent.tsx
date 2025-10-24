import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Loading from '@/components/shared/Loading'
import Logo from '@/components/template/Logo'
import { DEFAULT_COMPANY_PROFILE } from '@/constants/companyProfile.constant'
import { useLocation } from 'react-router-dom'
import { apiGetAccountInvoiceData } from '@/services/AccountServices'
import {
    apiGetSalesOrderDetails,
    apiPersistSalesDocumentFile,
    type SalesDocumentResource,
} from '@/services/SalesService'
import { apiGetSystemConfig } from '@/services/SettingsService'
import { HiOutlineDownload } from 'react-icons/hi'
import { useAppSelector } from '@/store'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { adaptOrderToDetailsView, type FxSnapshot } from '@/adapters/sales'
import { normalizeCurrencyCode } from '@/utils/currency'
import { resolveTextDirection } from '@/utils/textDirection'
import { sanitizeRichText } from '@/utils/security/inputGuards'
import type { Product, Summary } from './ContentTable'
import ContentTable from './ContentTable'

const INVOICE_CONTAINER_ID = 'invoice-print-root'
const DESKTOP_VIEWPORT_WIDTH = 1024

const linearToSrgb = (value: number) => {
    if (value <= 0.0031308) {
        return 12.92 * value
    }
    return 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

const convertOklchToRgba = (value: string): string | null => {
    const match = value
        .replace(/\s+/g, ' ')
        .match(
            /oklch\(\s*([0-9.+-]+%?)\s+([0-9.+-]+)\s+([0-9.+-]+)(deg|grad|rad|turn)?(?:\s*\/\s*([0-9.+-]+%?))?\s*\)/i,
        )
    if (!match) {
        return null
    }
    const [, lRaw, cRaw, hRaw, hUnit, alphaRaw] = match
    let l = parseFloat(lRaw)
    if (Number.isNaN(l)) {
        return null
    }
    if (lRaw.endsWith('%')) {
        l /= 100
    }
    const c = parseFloat(cRaw)
    if (Number.isNaN(c)) {
        return null
    }
    let h = parseFloat(hRaw)
    if (Number.isNaN(h)) {
        return null
    }
    const normalizedUnit = (hUnit || 'deg').toLowerCase()
    switch (normalizedUnit) {
        case 'grad':
            h = (h * Math.PI) / 200
            break
        case 'rad':
            break
        case 'turn':
            h = h * 2 * Math.PI
            break
        default:
            h = (h * Math.PI) / 180
            break
    }
    const a = Math.cos(h) * c
    const b = Math.sin(h) * c

    const l_ = l + 0.3963377774 * a + 0.2158037573 * b
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b
    const s_ = l - 0.0894841775 * a - 1.291485548 * b

    const l3 = l_ ** 3
    const m3 = m_ ** 3
    const s3 = s_ ** 3

    const rLinear =
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
    const gLinear =
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
    const bLinear =
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

    const r = clamp01(linearToSrgb(rLinear))
    const g = clamp01(linearToSrgb(gLinear))
    const bVal = clamp01(linearToSrgb(bLinear))

    let alpha = 1
    if (alphaRaw !== undefined) {
        let parsedAlpha = parseFloat(alphaRaw)
        if (Number.isNaN(parsedAlpha)) {
            parsedAlpha = 0
        }
        if (alphaRaw.trim().endsWith('%')) {
            parsedAlpha /= 100
        }
        alpha = clamp01(parsedAlpha)
    }

    const r255 = Math.round(r * 255)
    const g255 = Math.round(g * 255)
    const b255 = Math.round(bVal * 255)

    return `rgba(${r255}, ${g255}, ${b255}, ${alpha})`
}

const expandCssVariables = (
    value: string,
    styles: CSSStyleDeclaration,
): string => {
    let result = value
    const maxIterations = 10
    for (let i = 0; i < maxIterations; i += 1) {
        let replaced = false
        result = result.replace(
            /var\(\s*(--[a-z0-9-_]+)\s*(?:,\s*([^)]+))?\)/gi,
            (_substring, name: string, fallback?: string) => {
                const variableValue = styles.getPropertyValue(name)?.trim()
                if (variableValue) {
                    replaced = true
                    return variableValue
                }
                if (fallback) {
                    replaced = true
                    return fallback.trim()
                }
                replaced = true
                return ''
            },
        )
        if (!replaced) {
            break
        }
    }
    return result
}

const replaceOklchColors = (
    value: string,
    styles: CSSStyleDeclaration,
): string => {
    const lowerCased = value.toLowerCase()
    if (!lowerCased.includes('oklch(')) {
        return value
    }

    let result = ''
    let cursor = 0

    while (cursor < value.length) {
        const startIndex = lowerCased.indexOf('oklch(', cursor)
        if (startIndex === -1) {
            result += value.slice(cursor)
            break
        }
        result += value.slice(cursor, startIndex)

        let depth = 0
        let endIndex = startIndex
        for (let i = startIndex; i < value.length; i += 1) {
            const character = value[i]
            if (character === '(') {
                depth += 1
            } else if (character === ')') {
                depth -= 1
                if (depth === 0) {
                    endIndex = i
                    break
                }
            }
        }

        if (depth !== 0) {
            result += value.slice(startIndex)
            break
        }

        const segment = value.slice(startIndex, endIndex + 1)
        const expanded = expandCssVariables(segment, styles)
        const converted = convertOklchToRgba(expanded) ?? segment

        result += converted
        cursor = endIndex + 1
    }

    return result
}

const applyOklchFixesToTree = (root: HTMLElement) => {
    const ownerDocument = root.ownerDocument
    const defaultView = ownerDocument?.defaultView
    if (!ownerDocument || !defaultView) {
        return
    }

    const elements = [
        root,
        ...Array.from(root.querySelectorAll<HTMLElement>('*')),
    ]
    let pseudoCss = ''

    elements.forEach((element, index) => {
        const computed = defaultView.getComputedStyle(element)
        for (let i = 0; i < computed.length; i += 1) {
            const property = computed.item(i)
            if (!property) continue
            const value = computed.getPropertyValue(property)
            if (value && value.includes('oklch')) {
                element.style.setProperty(
                    property,
                    replaceOklchColors(value, computed),
                    computed.getPropertyPriority(property),
                )
            }
        }

        const processPseudo = (pseudo: '::before' | '::after') => {
            const pseudoStyles = defaultView.getComputedStyle(
                element,
                pseudo,
            )
            let declarations = ''
            let hasReplacement = false

            for (let i = 0; i < pseudoStyles.length; i += 1) {
                const property = pseudoStyles.item(i)
                if (!property) continue
                const value = pseudoStyles.getPropertyValue(property)
                if (value && value.includes('oklch')) {
                    hasReplacement = true
                    const replaced = replaceOklchColors(
                        value,
                        pseudoStyles,
                    )
                    const priority =
                        pseudoStyles.getPropertyPriority(property)
                    declarations += `${property}:${replaced}${
                        priority ? ' !important' : ''
                    };`
                }
            }

            if (hasReplacement) {
                element.setAttribute('data-h2c-index', String(index))
                pseudoCss += `[data-h2c-index="${index}"]${pseudo}{${declarations}}\n`
            }
        }

        processPseudo('::before')
        processPseudo('::after')
    })

    if (pseudoCss) {
        const styleElement = ownerDocument.createElement('style')
        styleElement.textContent = pseudoCss
        root.appendChild(styleElement)
    }
}

const replaceOklchSegments = (value: string): string => {
    const lowerCased = value.toLowerCase()
    if (!lowerCased.includes('oklch(')) {
        return value
    }

    let result = ''
    let cursor = 0
    while (cursor < value.length) {
        const startIndex = lowerCased.indexOf('oklch(', cursor)
        if (startIndex === -1) {
            result += value.slice(cursor)
            break
        }
        result += value.slice(cursor, startIndex)

        let depth = 0
        let endIndex = startIndex
        for (let i = startIndex; i < value.length; i += 1) {
            const character = value[i]
            if (character === '(') {
                depth += 1
            } else if (character === ')') {
                depth -= 1
                if (depth === 0) {
                    endIndex = i
                    break
                }
            }
        }

        if (depth !== 0) {
            result += value.slice(startIndex)
            break
        }

        const segment = value.slice(startIndex, endIndex + 1)
        const converted = convertOklchToRgba(segment) ?? segment

        result += converted
        cursor = endIndex + 1
    }
    return result
}

const sanitizeCssStyleDeclaration = (style: CSSStyleDeclaration) => {
    for (let i = 0; i < style.length; i += 1) {
        const property = style.item(i)
        if (!property) continue
        const value = style.getPropertyValue(property)
        if (value && value.includes('oklch')) {
            style.setProperty(
                property,
                replaceOklchSegments(value),
                style.getPropertyPriority(property),
            )
        }
    }
}

const hasCssRules = (
    rule: CSSRule,
): rule is CSSRule & { cssRules: CSSRuleList } => {
    return (
        'cssRules' in rule &&
        Boolean((rule as { cssRules?: CSSRuleList }).cssRules)
    )
}

const hasStyleDeclaration = (
    rule: CSSRule,
): rule is CSSRule & { style: CSSStyleDeclaration } => {
    return 'style' in rule && Boolean((rule as never).style)
}

const sanitizeCssRuleList = (rules: CSSRuleList) => {
    for (let i = 0; i < rules.length; i += 1) {
        const rule = rules.item(i)
        if (!rule) continue
        if (hasStyleDeclaration(rule)) {
            sanitizeCssStyleDeclaration(rule.style)
        }
        if (hasCssRules(rule)) {
            sanitizeCssRuleList(rule.cssRules)
        }
    }
}

const sanitizeDocumentStyleSheets = (doc: Document) => {
    try {
        const { styleSheets } = doc
        for (let i = 0; i < styleSheets.length; i += 1) {
            const sheet = styleSheets.item(i)
            if (!sheet) continue
            try {
                const rules = sheet.cssRules
                if (rules) {
                    sanitizeCssRuleList(rules)
                }
            } catch {
                // Ignore stylesheets we cannot access (cross-origin)
            }
        }
    } catch {
        // Some environments may not expose styleSheets; ignore
    }

    const styleElements = doc.querySelectorAll('style')
    styleElements.forEach((styleEl) => {
        const text = styleEl.textContent
        if (text && text.includes('oklch')) {
            styleEl.textContent = replaceOklchSegments(text)
        }
    })
}

const prepareNodeForCanvas = (node: HTMLElement) => {
    const clone = node.cloneNode(true) as HTMLElement
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    const width = Math.max(node.offsetWidth, DESKTOP_VIEWPORT_WIDTH)
    container.style.width = `${width}px`
    container.style.height = 'auto'
    container.style.maxWidth = 'none'
    container.style.pointerEvents = 'none'
    container.style.opacity = '0'
    container.style.zIndex = '-1'
    clone.style.width = '100%'
    clone.style.maxWidth = 'none'
    container.appendChild(clone)
    document.body.appendChild(container)

    applyOklchFixesToTree(clone)

    return { container, node: clone }
}

type Invoice = {
    id: string
    recipient: string
    email: string
    address: string[]
    phoneNumber: string
    dateTime: number
    product: Product[]
    paymentSummary: Summary
    comment?: string
    validUntil?: number | string | null
}

type GetAccountInvoiceDataRequest = {
    id: string
    resource?: SalesDocumentResource
}

type CompanyProfileApi = {
    legalName?: string | null
    tradeName?: string | null
    taxId?: string | null
    email?: string | null
    phone?: string | null
    website?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    logo?: string | null
}

type CompanyDetails = {
    legalName: string
    tradeName: string
    taxId: string | null
    email: string | null
    phone: string | null
    website: string | null
    address: string[]
    logo: string | null
}

type InvoiceApiResponse = Partial<Invoice> & { company?: CompanyProfileApi }

type GetAccountInvoiceDataResponse = InvoiceApiResponse

type InvoiceContentProps = {
    resource?: SalesDocumentResource
}

type AddressLines = {
    line1?: string
    line2?: string
    line3?: string
    line4?: string
}

type InvoiceCustomerDetails = {
    name?: string
    email?: string
    phone?: string
    shippingAddress?: AddressLines
    billingAddress?: AddressLines
}

type InvoiceOrderDetails = {
    id?: string
    dateTime?: number
    validUntil?: number | string | null
    paymentSummary?: Summary
    product?: Product[]
    customer?: InvoiceCustomerDetails
    fxSnapshot?: FxSnapshot
    comment?: string
}

type BudgetInfoItem = {
    key: string
    label: string
    value: string | string[]
    isAddress?: boolean
    fullWidth?: boolean
}

const DEFAULT_COMPANY_DETAILS: CompanyDetails = {
    legalName: DEFAULT_COMPANY_PROFILE.legalName,
    tradeName: DEFAULT_COMPANY_PROFILE.tradeName,
    taxId: DEFAULT_COMPANY_PROFILE.taxId,
    email: DEFAULT_COMPANY_PROFILE.email,
    phone: DEFAULT_COMPANY_PROFILE.phone,
    website: DEFAULT_COMPANY_PROFILE.website,
    address: [
        DEFAULT_COMPANY_PROFILE.addressLine1,
        DEFAULT_COMPANY_PROFILE.addressLine2,
    ].filter((line): line is string => typeof line === 'string' && line.length > 0),
    logo: DEFAULT_COMPANY_PROFILE.logo ?? null,
}

const mapCompanyProfileToDetails = (
    profile?: CompanyProfileApi | null,
): CompanyDetails => {
    if (!profile) {
        return { ...DEFAULT_COMPANY_DETAILS }
    }

    const safeTrim = (value: string | null | undefined) =>
        typeof value === 'string' ? value.trim() : ''

    const hasCustomData = Object.entries(profile).some(([key, raw]) => {
        if (key === 'logo') {
            return false
        }
        return safeTrim(raw as string).length > 0
    })

    const ensureValue = (value: string | null | undefined, fallback?: string) => {
        const trimmed = safeTrim(value)
        if (trimmed) {
            return trimmed
        }
        if (!hasCustomData && fallback) {
            return fallback
        }
        return ''
    }

    const optionalValue = (value: string | null | undefined) => {
        const trimmed = safeTrim(value)
        return trimmed.length ? trimmed : null
    }

    const addressEntries = [profile.addressLine1, profile.addressLine2]
        .map((line) => safeTrim(line))
        .filter((line) => line.length > 0)

    const resolvedAddress = addressEntries.length
        ? addressEntries
        : hasCustomData
        ? []
        : [...DEFAULT_COMPANY_DETAILS.address]

    return {
        legalName: ensureValue(profile.legalName, DEFAULT_COMPANY_DETAILS.legalName),
        tradeName: ensureValue(profile.tradeName, DEFAULT_COMPANY_DETAILS.tradeName),
        taxId: optionalValue(profile.taxId),
        email: optionalValue(profile.email),
        phone: optionalValue(profile.phone),
        website: optionalValue(profile.website),
        address: resolvedAddress,
        logo: optionalValue(profile.logo),
    }
}

const splitCustomerName = (value?: string) => {
    if (!value) {
        return { firstName: '', lastName: '' }
    }
    const trimmed = value.trim()
    if (!trimmed) {
        return { firstName: '', lastName: '' }
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' }
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    }
}

const addressLinesFromObject = (address?: AddressLines) => {
    if (!address) {
        return []
    }
    const lines = [address.line1, address.line2, address.line3, address.line4]
    return lines
        .map((line) => (line ? line.toString().trim() : ''))
        .filter((line) => line.length > 0)
}

const valueOrDash = (value?: string | null) => {
    const trimmed = value?.toString().trim()
    return trimmed && trimmed.length > 0 ? trimmed : '—'
}

const formatDateValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return ''
    }
    if (value instanceof Date) {
        const parsed = dayjs(value)
        return parsed.isValid() ? parsed.format('DD/MM/YYYY') : ''
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) {
            return ''
        }
        const dayjsInstance =
            value > 1e12 ? dayjs(value) : dayjs.unix(value)
        return dayjsInstance.isValid()
            ? dayjsInstance.format('DD/MM/YYYY')
            : ''
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) {
            return ''
        }
        const numeric = Number(trimmed)
        if (Number.isFinite(numeric) && numeric > 0) {
            const dayjsInstance =
                numeric > 1e12 ? dayjs(numeric) : dayjs.unix(numeric)
            if (dayjsInstance.isValid()) {
                return dayjsInstance.format('DD/MM/YYYY')
            }
        }
        const parsed = dayjs(trimmed)
        return parsed.isValid() ? parsed.format('DD/MM/YYYY') : ''
    }
    return ''
}

const InvoiceContent = ({ resource = 'orders' }: InvoiceContentProps) => {
    const { t } = useTranslation()

    const location = useLocation()

    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<Partial<Invoice>>({})
    const [orderData, setOrderData] = useState<InvoiceOrderDetails | null>(null)
    const [companyDetails, setCompanyDetails] =
        useState<CompanyDetails>(DEFAULT_COMPANY_DETAILS)
    const [downloadingPdf, setDownloadingPdf] = useState(false)
    const [printingPdf, setPrintingPdf] = useState(false)
    const [taxRate, setTaxRate] = useState<number>()

    const invoiceRef = useRef<HTMLDivElement>(null)

    const mode = useAppSelector((state) => state.theme.mode)
    const storeCurrency = useAppSelector((state) => state.currency.code)

    const isBudgetDocument = resource === 'budgets'
    const documentNumberLabel = isBudgetDocument
        ? t('text.labels.budgetNumber', {
              defaultValue: 'Budget number',
          })
        : t('text.labels.invoiceNumber')
    const documentTitle = isBudgetDocument
        ? t('text.titles.budget', { defaultValue: 'Budget' })
        : t('text.titles.invoice')
    const showBillingAddress = !isBudgetDocument

    const loadInvoice = useCallback(async () => {
        const id = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        if (!id) {
            return
        }
        setLoading(true)
        try {
            const [invoiceResult, orderResult] = await Promise.allSettled([
                apiGetAccountInvoiceData<
                    GetAccountInvoiceDataResponse,
                    GetAccountInvoiceDataRequest
                >({ id, resource }),
                apiGetSalesOrderDetails<
                    unknown,
                    { id: string }
                >({ id }, resource),
            ])

            if (
                invoiceResult.status === 'fulfilled' &&
                invoiceResult.value &&
                typeof invoiceResult.value === 'object'
            ) {
                const response = invoiceResult.value as {
                    data?: GetAccountInvoiceDataResponse
                }
                if (response?.data) {
                    const { company, ...invoiceData } = response.data
                    if (invoiceData && typeof invoiceData === 'object') {
                        setData(invoiceData)
                    }
                    setCompanyDetails(mapCompanyProfileToDetails(company))
                } else {
                    setCompanyDetails(DEFAULT_COMPANY_DETAILS)
                }
            }

            if (
                orderResult.status === 'fulfilled' &&
                orderResult.value &&
                typeof orderResult.value === 'object'
            ) {
                const response = orderResult.value as { data?: unknown }
                const mapped = adaptOrderToDetailsView(response?.data)
                if (mapped && typeof mapped === 'object') {
                    const structured: InvoiceOrderDetails = {
                        id: mapped.id,
                        dateTime: mapped.dateTime,
                        paymentSummary: mapped.paymentSummary as Summary,
                        product: mapped.product as Product[],
                        customer: mapped.customer as InvoiceCustomerDetails,
                        fxSnapshot: mapped.fxSnapshot,
                        validUntil: mapped.validUntil,
                        comment:
                            typeof mapped.comment === 'string'
                                ? mapped.comment
                                : undefined,
                    }
                    setOrderData(structured)
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to load invoice data', error)
        } finally {
            setLoading(false)
        }
    }, [location.pathname, resource])

    useEffect(() => {
        loadInvoice()
    }, [loadInvoice])

    useEffect(() => {
        let cancelled = false
        apiGetSystemConfig<{ taxRate?: number }>()
            .then((response) => {
                if (cancelled) {
                    return
                }
                const numeric = Number((response.data as any)?.taxRate)
                if (Number.isFinite(numeric)) {
                    setTaxRate(numeric)
                } else {
                    setTaxRate(undefined)
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTaxRate(undefined)
                }
            })
        return () => {
            cancelled = true
        }
    }, [])

    const generateInvoicePdf = useCallback(async () => {
        if (!invoiceRef.current) {
            throw new Error('Invoice content unavailable')
        }
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
            import('html2canvas'),
            import('jspdf'),
        ])

        const prepared = prepareNodeForCanvas(invoiceRef.current)

        try {
            const viewportWidth = Math.max(
                DESKTOP_VIEWPORT_WIDTH,
                prepared.node.scrollWidth,
                prepared.node.offsetWidth,
            )
            const viewportHeight = Math.max(
                prepared.node.scrollHeight,
                prepared.node.offsetHeight,
                prepared.node.clientHeight,
                1,
            )

            const canvas = await html2canvas(prepared.node, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: viewportWidth,
                windowHeight: viewportHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDocument) => {
                    sanitizeDocumentStyleSheets(clonedDocument)
                    const target = clonedDocument.getElementById(
                        INVOICE_CONTAINER_ID,
                    )
                    if (target instanceof HTMLElement) {
                        applyOklchFixesToTree(target)
                    }
                },
            })

            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width
            const pageHeight = pdf.internal.pageSize.getHeight()
            let heightLeft = pdfHeight
            let position = 0

            pdf.addImage(
                imgData,
                'PNG',
                0,
                position,
                pdfWidth,
                pdfHeight,
                undefined,
                'FAST',
            )

            heightLeft -= pageHeight

            while (heightLeft > 0) {
                position = heightLeft - pdfHeight
                pdf.addPage()
                pdf.addImage(
                    imgData,
                    'PNG',
                    0,
                    position,
                    pdfWidth,
                    pdfHeight,
                    undefined,
                    'FAST',
                )
                heightLeft -= pageHeight
            }

            return pdf
        } finally {
            if (prepared.container.parentNode) {
                prepared.container.parentNode.removeChild(prepared.container)
            }
        }
    }, [])

    const persistBudgetDocument = useCallback(
        async (blob: Blob, fileName: string) => {
            if (!isBudgetDocument) {
                return
            }
            const rawId = orderData?.id ?? data?.id
            const numericId = Number(rawId)
            if (!Number.isFinite(numericId) || numericId <= 0) {
                return
            }
            const formData = new FormData()
            formData.append('file', blob, fileName)
            try {
                await apiPersistSalesDocumentFile(numericId, formData, resource)
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('Failed to persist budget document file', error)
            }
        },
        [data?.id, isBudgetDocument, orderData?.id, resource],
    )

    const handleDownloadPdf = useCallback(async () => {
        const invoiceId = orderData?.id ?? data?.id
        try {
            setDownloadingPdf(true)
            const pdf = await generateInvoicePdf()
            const fileName = `invoice-${invoiceId ?? 'document'}.pdf`
            const blobOutput = pdf.output('blob')
            if (blobOutput instanceof Blob) {
                void persistBudgetDocument(blobOutput, fileName)
            }
            pdf.save(fileName)
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to generate invoice PDF', error)
            toast.push(
                <Notification
                    type="danger"
                    title={t('text.titles.invoice')}
                >
                    {t('text.messages.invoiceDownloadError')}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setDownloadingPdf(false)
        }
    }, [data?.id, generateInvoicePdf, orderData?.id, persistBudgetDocument, t])

    const handlePrintPdf = useCallback(async () => {
        try {
            setPrintingPdf(true)
            const pdf = await generateInvoicePdf()
            pdf.autoPrint()
            const blob = pdf.output('blob')
            const blobUrl = URL.createObjectURL(blob)
            const iframe = document.createElement('iframe')
            iframe.style.position = 'fixed'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            iframe.src = blobUrl
            const cleanup = () => {
                setTimeout(() => {
                    if (iframe.parentNode) {
                        iframe.parentNode.removeChild(iframe)
                    }
                    URL.revokeObjectURL(blobUrl)
                }, 1000)
            }
            iframe.onload = () => {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
                cleanup()
            }
            document.body.appendChild(iframe)
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to generate invoice print PDF', error)
            toast.push(
                <Notification
                    type="danger"
                    title={t('text.titles.invoice')}
                >
                    {t('text.messages.invoiceDownloadError')}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setPrintingPdf(false)
        }
    }, [generateInvoicePdf, t])

    const paymentSummary = useMemo<Summary | undefined>(() => {
        if (orderData?.paymentSummary) {
            return orderData.paymentSummary
        }
        return data.paymentSummary
    }, [data.paymentSummary, orderData])

    const paymentSummaryWithTaxRate = useMemo<Summary | undefined>(() => {
        if (!paymentSummary) {
            return paymentSummary
        }
        if (typeof taxRate === 'number') {
            return { ...paymentSummary, taxRate }
        }
        return paymentSummary
    }, [paymentSummary, taxRate])

    const products = useMemo<Product[]>(() => {
        if (orderData?.product && Array.isArray(orderData.product)) {
            return orderData.product
        }
        if (Array.isArray(data.product)) {
            return data.product
        }
        return []
    }, [data.product, orderData])

    const invoiceDate = orderData?.dateTime ?? data.dateTime
    const rawValidUntil = orderData?.validUntil ?? data.validUntil
    const invoiceId = orderData?.id ?? data?.id
    const formattedInvoiceDate = useMemo(
        () => formatDateValue(invoiceDate),
        [invoiceDate],
    )
    const formattedValidUntil = useMemo(
        () => formatDateValue(rawValidUntil),
        [rawValidUntil],
    )
    const customer = orderData?.customer
    const recipientName =
        customer?.name ?? data.recipient ?? ''
    const { firstName, lastName } = useMemo(
        () => splitCustomerName(recipientName),
        [recipientName],
    )
    const customerFullName = useMemo(() => {
        const combined = [firstName, lastName].filter(Boolean).join(' ')
        return combined || recipientName
    }, [firstName, lastName, recipientName])
    const customerEmail = customer?.email ?? data.email
    const customerPhone = customer?.phone ?? data.phoneNumber

    const fallbackAddressLines = useMemo(() => {
        if (!Array.isArray(data.address)) {
            return []
        }
        return data.address
            .map((line) => (typeof line === 'string' ? line.trim() : ''))
            .filter((line) => line.length > 0)
    }, [data.address])

    const rawShippingAddressLines = useMemo(
        () => addressLinesFromObject(customer?.shippingAddress),
        [customer?.shippingAddress],
    )
    const rawBillingAddressLines = useMemo(
        () => addressLinesFromObject(customer?.billingAddress),
        [customer?.billingAddress],
    )

    const shippingAddressLines = useMemo(() => {
        if (rawShippingAddressLines.length > 0) {
            return rawShippingAddressLines
        }
        if (rawBillingAddressLines.length > 0) {
            return rawBillingAddressLines
        }
        return fallbackAddressLines
    }, [rawShippingAddressLines, rawBillingAddressLines, fallbackAddressLines])

    const billingAddressLines = useMemo(() => {
        if (rawBillingAddressLines.length > 0) {
            return rawBillingAddressLines
        }
        if (rawShippingAddressLines.length > 0) {
            return rawShippingAddressLines
        }
        return fallbackAddressLines
    }, [rawBillingAddressLines, rawShippingAddressLines, fallbackAddressLines])

    const budgetAddressLines = useMemo(() => {
        if (shippingAddressLines.length > 0) {
            return shippingAddressLines
        }
        if (billingAddressLines.length > 0) {
            return billingAddressLines
        }
        return fallbackAddressLines
    }, [billingAddressLines, fallbackAddressLines, shippingAddressLines])

    const budgetInfoItems = useMemo<BudgetInfoItem[]>(() => {
        if (!isBudgetDocument) {
            return []
        }
        const invoiceIdText =
            invoiceId === undefined || invoiceId === null
                ? ''
                : String(invoiceId)
        const budgetValidityLabel = t('text.labels.budgetValidity', {
            defaultValue: t('sales.orders.validUntilLabel', {
                defaultValue: 'Valid until',
            }),
        })
        const nameLabel = t('text.labels.name', {
            defaultValue: t('text.labels.billTo'),
        })
        const addressLabel = t('text.labels.address')
        return [
            {
                key: 'document-number',
                label: documentNumberLabel,
                value: valueOrDash(invoiceIdText),
            },
            {
                key: 'issued-on',
                label: t('text.labels.issuedOn'),
                value: invoiceDate
                    ? formattedInvoiceDate
                    : t('text.labels.unknownDate'),
            },
            {
                key: 'valid-until',
                label: budgetValidityLabel,
                value: valueOrDash(formattedValidUntil),
            },
            {
                key: 'name',
                label: nameLabel,
                value: valueOrDash(customerFullName),
            },
            {
                key: 'email',
                label: t('text.labels.email'),
                value: valueOrDash(customerEmail),
            },
            {
                key: 'phone',
                label: t('text.labels.phone'),
                value: valueOrDash(customerPhone),
            },
            {
                key: 'address',
                label: addressLabel,
                value: budgetAddressLines,
                isAddress: true,
                fullWidth: true,
            },
        ]
    }, [
        budgetAddressLines,
        customerEmail,
        customerFullName,
        customerPhone,
        documentNumberLabel,
        formattedInvoiceDate,
        formattedValidUntil,
        invoiceDate,
        invoiceId,
        isBudgetDocument,
        t,
    ])

    const orderCurrency = useMemo(() => {
        const candidates = [
            paymentSummaryWithTaxRate?.currency,
            orderData?.fxSnapshot?.base,
            products[0]?.currency,
            data.paymentSummary?.currency,
            storeCurrency,
        ]
        for (const candidate of candidates) {
            const normalized = normalizeCurrencyCode(candidate, storeCurrency)
            if (normalized) return normalized
        }
        return normalizeCurrencyCode(storeCurrency, 'UYU') ?? 'UYU'
    }, [
        data.paymentSummary?.currency,
        orderData?.fxSnapshot?.base,
        paymentSummaryWithTaxRate?.currency,
        products,
        storeCurrency,
    ])

    const orderComment = useMemo(() => {
        const comments = [orderData?.comment, data.comment]
        const first = comments.find(
            (value) => typeof value === 'string' && value.trim().length > 0,
        )
        return typeof first === 'string' ? first.trim() : ''
    }, [data.comment, orderData?.comment])

    const disclaimerLabel = t('text.labels.disclaimer', {
        defaultValue: 'Disclaimer',
    })

    const documentDisclaimerHtml = useMemo(() => {
        const candidates = [orderData?.disclaimer, data.disclaimer]
        const first = candidates.find(
            (value) => typeof value === 'string' && value.trim().length > 0,
        )
        if (typeof first !== 'string') {
            return ''
        }
        return sanitizeRichText(first)
    }, [data.disclaimer, orderData?.disclaimer])

    const documentDisclaimerDirection = useMemo(() => {
        if (!documentDisclaimerHtml) {
            return 'ltr'
        }
        const plain = documentDisclaimerHtml.replace(/<[^>]+>/g, ' ').trim()
        if (!plain) {
            return 'ltr'
        }
        return resolveTextDirection(plain)
    }, [documentDisclaimerHtml])

    const hasContent =
        Boolean(orderData) ||
        Boolean(data && Object.keys(data).length > 0)

    return (
        <Loading loading={loading}>
            {hasContent && (
                <div className="flex flex-col gap-6">
                    <div
                        id={INVOICE_CONTAINER_ID}
                        ref={invoiceRef}
                        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 print:rounded-none print:border-0 print:shadow-none"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <Logo
                                    className="h-12 w-auto md:h-14"
                                    mode={mode}
                                    customSrc={companyDetails.logo ?? undefined}
                                />
                                <div className="text-right md:text-left">
                                    <h4 className="text-xl font-semibold">
                                        {documentTitle}{' '}
                                        <span className="text-primary-600">
                                            #{invoiceId}
                                        </span>
                                    </h4>
                                </div>
                            </div>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-700">
                                    <div className="grid gap-6 sm:grid-cols-2">
                                        <div className="space-y-4 sm:col-span-2">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.issuedBy')}
                                                </p>
                                                <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                    {companyDetails.legalName}
                                                </p>
                                                {companyDetails.tradeName ? (
                                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                                        {companyDetails.tradeName}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.address')}
                                                </p>
                                                <address className="mt-1 not-italic space-y-1 text-gray-800 dark:text-gray-100">
                                                    {companyDetails.address.length > 0 ? (
                                                        companyDetails.address.map((line) => (
                                                            <div key={line}>{line}</div>
                                                        ))
                                                    ) : (
                                                        <div>{valueOrDash()}</div>
                                                    )}
                                                </address>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.phone')}
                                                </p>
                                                <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                    {valueOrDash(companyDetails.phone)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.email')}
                                                </p>
                                                <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                    {valueOrDash(companyDetails.email)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.website')}
                                                </p>
                                                <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                    {valueOrDash(companyDetails.website)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    {t('text.labels.taxId')}
                                                </p>
                                                <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                    {valueOrDash(companyDetails.taxId)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-700">
                                    {isBudgetDocument ? (
                                        <div className="grid gap-6">
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                {budgetInfoItems.map((item) => (
                                                    <div
                                                        key={item.key}
                                                        className={`space-y-1 ${item.fullWidth ? 'sm:col-span-2' : ''}`}
                                                    >
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                            {item.label}
                                                        </p>
                                                        {item.isAddress ? (
                                                            <address className="mt-1 space-y-1 not-italic text-gray-800 dark:text-gray-100">
                                                                {Array.isArray(item.value) &&
                                                                item.value.length > 0 ? (
                                                                    item.value.map((line, index) => (
                                                                        <div key={`${item.key}-${index}`}>{line}</div>
                                                                    ))
                                                                ) : (
                                                                    <div>{valueOrDash()}</div>
                                                                )}
                                                            </address>
                                                        ) : (
                                                            <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                                {Array.isArray(item.value)
                                                                    ? valueOrDash()
                                                                    : item.value}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6 sm:grid-cols-2">
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {t('text.labels.issuedBy')}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {companyDetails.legalName}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {documentNumberLabel}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {invoiceId}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {t('text.labels.issuedOn')}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {invoiceDate
                                                            ? formattedInvoiceDate
                                                            : t('text.labels.unknownDate')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {t('text.labels.billTo')}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {valueOrDash(customerFullName)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {t('text.labels.email')}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {valueOrDash(customerEmail)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                        {t('text.labels.phone')}
                                                    </p>
                                                    <p className="mt-1 font-medium text-gray-800 dark:text-gray-100">
                                                        {valueOrDash(customerPhone)}
                                                    </p>
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                            {t('text.titles.shippingAddress')}
                                                        </p>
                                                        <address className="mt-1 space-y-1 not-italic text-gray-800 dark:text-gray-100">
                                                            {shippingAddressLines.length > 0 ? (
                                                                shippingAddressLines.map((line, index) => (
                                                                    <div key={`shipping-${index}`}>{line}</div>
                                                                ))
                                                            ) : (
                                                                <div>{valueOrDash()}</div>
                                                            )}
                                                        </address>
                                                    </div>
                                                    {showBillingAddress && (
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                {t('text.titles.billingAddress')}
                                                            </p>
                                                            <address className="mt-1 space-y-1 not-italic text-gray-800 dark:text-gray-100">
                                                                {billingAddressLines.length > 0 ? (
                                                                    billingAddressLines.map((line, index) => (
                                                                        <div key={`billing-${index}`}>{line}</div>
                                                                    ))
                                                                ) : (
                                                                    <div>{valueOrDash()}</div>
                                                                )}
                                                            </address>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="mt-10">
                            <ContentTable
                                products={products}
                                summary={paymentSummaryWithTaxRate}
                                orderCurrency={orderCurrency}
                                fxSnapshot={orderData?.fxSnapshot}
                                resource={resource}
                            />
                            {isBudgetDocument && documentDisclaimerHtml && (
                                <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                    <h6 className="font-semibold text-gray-700 dark:text-gray-200">
                                        {disclaimerLabel}
                                    </h6>
                                    <div
                                        className="mt-2 text-sm text-gray-700 dark:text-gray-200"
                                        dir={documentDisclaimerDirection}
                                        dangerouslySetInnerHTML={{
                                            __html: documentDisclaimerHtml,
                                        }}
                                    />
                                </div>
                            )}
                            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <h6 className="font-semibold text-gray-700 dark:text-gray-200">
                                    {t('text.columns.comments')}
                                </h6>
                                <p
                                    className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200"
                                    dir={resolveTextDirection(orderComment)}
                                >
                                    {orderComment || '\u00a0'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="print:hidden mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <small className="italic">
                            {t('text.messages.invoiceNote')}
                        </small>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                variant="default"
                                icon={<HiOutlineDownload />}
                                loading={downloadingPdf}
                                disabled={printingPdf}
                                onClick={handleDownloadPdf}
                            >
                                {t('text.actions.download')}
                            </Button>
                            <Button
                                variant="solid"
                                loading={printingPdf}
                                disabled={downloadingPdf}
                                onClick={handlePrintPdf}
                            >
                                {t('text.actions.print')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Loading>
    )
}

export default InvoiceContent
