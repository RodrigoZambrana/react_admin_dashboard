import AdaptableCard from '@/components/shared/AdaptableCard'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switcher from '@/components/ui/Switcher'
import { FormItem } from '@/components/ui/Form'
import { useTranslation } from 'react-i18next'
import type { SalesUnit } from '@/constants/product.constant'

type InstallationServiceForm = {
    name: string
    productCode: string
    description: string
    salePrice: string
    costPrice: string
    currency: string
    taxRate: string
    unitOfMeasure: SalesUnit
}

type InstallationFieldsValues = {
    installationResolutionMode?: string | null
    installationChargeScope?: string | null
    installationPricePresentationMode?: string | null
    hasInstallationServiceOverride?: boolean
    installationService?: InstallationServiceForm | null
}

type InstallationFieldsProps = {
    values: InstallationFieldsValues
    setFieldValue: (field: string, value: unknown) => void
}

const INSTALLATION_MODE_OPTIONS = [
    { value: '', label: 'Heredar categoría' },
    { value: 'INCLUDED', label: 'Incluida' },
    { value: 'OPTIONAL_ADD_ON', label: 'Opcional adicional' },
    { value: 'SEPARATE_SERVICE', label: 'Servicio separado' },
    { value: 'NOT_OFFERED', label: 'No ofrecida' },
    { value: 'UNKNOWN', label: 'Confirmar manualmente' },
]

const INSTALLATION_CHARGE_SCOPE_OPTIONS = [
    { value: '', label: 'Heredar categoría' },
    { value: 'PER_QUOTE', label: 'Por cotización' },
    { value: 'MATCH_PRODUCT_QUANTITY', label: 'Por cantidad del producto' },
    { value: 'MATCH_PRODUCT_MEASUREMENTS', label: 'Por medidas del producto' },
]

const INSTALLATION_PRICE_PRESENTATION_OPTIONS = [
    { value: '', label: 'Heredar categoría' },
    { value: 'HIDDEN', label: 'No exponer precio automáticamente' },
    { value: 'EXACT', label: 'Mostrar precio exacto' },
    { value: 'FROM_BASE', label: 'Mostrar “a partir de…”' },
]

const SALES_UNIT_OPTIONS: Array<{ value: SalesUnit; label: string }> = [
    { value: 'UNIT', label: 'UNIT' },
    { value: 'SQUARE_METER', label: 'SQUARE_METER' },
    { value: 'LINEAR_METER', label: 'LINEAR_METER' },
]

const DEFAULT_SERVICE = {
    name: '',
    productCode: '',
    description: '',
    salePrice: '',
    costPrice: '',
    currency: 'USD',
    taxRate: '',
    unitOfMeasure: 'UNIT' as SalesUnit,
}

const InstallationFields = ({ values, setFieldValue }: InstallationFieldsProps) => {
    const { t } = useTranslation()
    const service = values.installationService ?? DEFAULT_SERVICE
    const hasOverride = Boolean(values.hasInstallationServiceOverride)

    const updateServiceField = (key: keyof InstallationServiceForm, value: string) => {
        setFieldValue('installationService', {
            ...service,
            [key]: value,
        })
    }

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('sales.productForm.installation.title', { defaultValue: 'Instalación' })}</h5>
            <p className="mb-6">
                {t('sales.productForm.installation.description', {
                    defaultValue:
                        'Definí si este producto incluye instalación, si se agrega aparte o si hereda la política de su categoría.',
                })}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormItem
                    label={t('sales.productForm.installation.mode', {
                        defaultValue: 'Resolución de instalación',
                    })}
                >
                    <Select
                        options={INSTALLATION_MODE_OPTIONS}
                        value={
                            INSTALLATION_MODE_OPTIONS.find(
                                (option) =>
                                    option.value ===
                                    String(values.installationResolutionMode ?? ''),
                            ) ?? INSTALLATION_MODE_OPTIONS[0]
                        }
                        onChange={(option) =>
                            setFieldValue(
                                'installationResolutionMode',
                                (option as { value: string } | null)?.value || null,
                            )
                        }
                        isClearable={false}
                    />
                </FormItem>
                <FormItem
                    label={t('sales.productForm.installation.chargeScope', {
                        defaultValue: 'Cobro de instalación',
                    })}
                >
                    <Select
                        options={INSTALLATION_CHARGE_SCOPE_OPTIONS}
                        value={
                            INSTALLATION_CHARGE_SCOPE_OPTIONS.find(
                                (option) =>
                                    option.value ===
                                    String(values.installationChargeScope ?? ''),
                            ) ?? INSTALLATION_CHARGE_SCOPE_OPTIONS[0]
                        }
                        onChange={(option) =>
                            setFieldValue(
                                'installationChargeScope',
                                (option as { value: string } | null)?.value || null,
                            )
                        }
                        isClearable={false}
                    />
                </FormItem>
                <FormItem
                    label={t('sales.productForm.installation.pricePresentationMode', {
                        defaultValue: 'Presentación del precio',
                    })}
                >
                    <Select
                        options={INSTALLATION_PRICE_PRESENTATION_OPTIONS}
                        value={
                            INSTALLATION_PRICE_PRESENTATION_OPTIONS.find(
                                (option) =>
                                    option.value ===
                                    String(values.installationPricePresentationMode ?? ''),
                            ) ?? INSTALLATION_PRICE_PRESENTATION_OPTIONS[0]
                        }
                        onChange={(option) =>
                            setFieldValue(
                                'installationPricePresentationMode',
                                (option as { value: string } | null)?.value || null,
                            )
                        }
                        isClearable={false}
                    />
                </FormItem>
            </div>

            <div className="mt-2 flex items-center gap-3">
                <Switcher
                    checked={hasOverride}
                    onChange={(checked) => {
                        setFieldValue('hasInstallationServiceOverride', checked)
                        if (!checked) {
                            setFieldValue('installationService', null)
                        } else if (!values.installationService) {
                            setFieldValue('installationService', DEFAULT_SERVICE)
                        }
                    }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {t('sales.productForm.installation.serviceOverride', {
                        defaultValue: 'Usar servicio/costo de instalación específico para este producto',
                    })}
                </span>
            </div>

            {hasOverride ? (
                <div className="mt-4 space-y-4 rounded-md border border-gray-200 p-4 dark:border-gray-600">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormItem
                            label={t('sales.productForm.installation.serviceName', {
                                defaultValue: 'Nombre del servicio',
                            })}
                        >
                            <Input
                                value={service.name}
                                onChange={(event) =>
                                    updateServiceField('name', event.target.value)
                                }
                                placeholder="Instalación"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.serviceCode', {
                                defaultValue: 'Código del servicio',
                            })}
                        >
                            <Input
                                value={service.productCode}
                                onChange={(event) =>
                                    updateServiceField('productCode', event.target.value)
                                }
                                placeholder="INST-001"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.salePrice', {
                                defaultValue: 'Precio de venta',
                            })}
                        >
                            <Input
                                value={service.salePrice}
                                onChange={(event) =>
                                    updateServiceField('salePrice', event.target.value)
                                }
                                placeholder="150"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.costPrice', {
                                defaultValue: 'Costo interno',
                            })}
                        >
                            <Input
                                value={service.costPrice}
                                onChange={(event) =>
                                    updateServiceField('costPrice', event.target.value)
                                }
                                placeholder="0"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.currency', {
                                defaultValue: 'Moneda',
                            })}
                        >
                            <Input
                                value={service.currency}
                                onChange={(event) =>
                                    updateServiceField('currency', event.target.value.toUpperCase())
                                }
                                placeholder="USD"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.taxRate', {
                                defaultValue: 'IVA',
                            })}
                        >
                            <Input
                                value={service.taxRate}
                                onChange={(event) =>
                                    updateServiceField('taxRate', event.target.value)
                                }
                                placeholder="22"
                            />
                        </FormItem>
                        <FormItem
                            label={t('sales.productForm.installation.unitOfMeasure', {
                                defaultValue: 'Unidad de venta',
                            })}
                        >
                            <Select
                                options={SALES_UNIT_OPTIONS}
                                value={
                                    SALES_UNIT_OPTIONS.find(
                                        (option) =>
                                            option.value ===
                                            (service.unitOfMeasure || 'UNIT'),
                                    ) ?? SALES_UNIT_OPTIONS[0]
                                }
                                onChange={(option) =>
                                    updateServiceField(
                                        'unitOfMeasure',
                                        ((option as { value: SalesUnit } | null)?.value ??
                                            'UNIT') as string,
                                    )
                                }
                                isClearable={false}
                            />
                        </FormItem>
                    </div>
                    <FormItem
                        label={t('sales.productForm.installation.serviceDescription', {
                            defaultValue: 'Descripción del servicio',
                        })}
                    >
                        <Input
                            textArea
                            rows={3}
                            value={service.description}
                            onChange={(event) =>
                                updateServiceField('description', event.target.value)
                            }
                            placeholder="Detalle opcional del servicio de instalación"
                        />
                    </FormItem>
                </div>
            ) : null}
        </AdaptableCard>
    )
}

export default InstallationFields
