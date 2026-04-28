import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from 'react'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import {
    apiGetCompanyProfile,
    apiUpdateCompanyProfile,
} from '@/services/SettingsService'
import { DEFAULT_COMPANY_PROFILE } from '@/constants/companyProfile.constant'
import { updateCompanyLogoCache } from '@/components/template/Logo'

type CompanyProfileForm = {
    legalName: string
    tradeName: string
    taxId: string
    email: string
    phone: string
    website: string
    addressLine1: string
    addressLine2: string
    seoDescription: string
    seoAuthor: string
    seoImageUrl: string
    googleSiteVerification: string
}

type CompanyProfileResponse = Partial<
    Record<keyof CompanyProfileForm, string | null>
> & { logo?: string | null }

type CompanyProfileUpdateRequest = {
    legalName: string
    tradeName: string
    taxId: string | null
    email: string | null
    phone: string | null
    website: string | null
    addressLine1: string | null
    addressLine2: string | null
    seoDescription: string | null
    seoAuthor: string | null
    seoImageUrl: string | null
    googleSiteVerification: string | null
    logo?: string | null
}

const MAX_LOGO_SIZE_BYTES = 512 * 1024
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
const normalizeLogoData = (value?: string | null): string | null =>
    typeof value === 'string' && value.trim().length ? value.trim() : null

const toFormValues = (payload?: CompanyProfileResponse): CompanyProfileForm => {
    if (!payload) {
        return {
            legalName: DEFAULT_COMPANY_PROFILE.legalName,
            tradeName: DEFAULT_COMPANY_PROFILE.tradeName,
            taxId: DEFAULT_COMPANY_PROFILE.taxId ?? '',
            email: DEFAULT_COMPANY_PROFILE.email ?? '',
            phone: DEFAULT_COMPANY_PROFILE.phone ?? '',
            website: DEFAULT_COMPANY_PROFILE.website ?? '',
            addressLine1: DEFAULT_COMPANY_PROFILE.addressLine1 ?? '',
            addressLine2: DEFAULT_COMPANY_PROFILE.addressLine2 ?? '',
            seoDescription: DEFAULT_COMPANY_PROFILE.seoDescription ?? '',
            seoAuthor: DEFAULT_COMPANY_PROFILE.seoAuthor ?? '',
            seoImageUrl: DEFAULT_COMPANY_PROFILE.seoImageUrl ?? '',
            googleSiteVerification:
                DEFAULT_COMPANY_PROFILE.googleSiteVerification ?? '',
        }
    }

    return {
        legalName: payload.legalName ?? DEFAULT_COMPANY_PROFILE.legalName,
        tradeName: payload.tradeName ?? DEFAULT_COMPANY_PROFILE.tradeName,
        taxId: payload.taxId ?? '',
        email: payload.email ?? '',
        phone: payload.phone ?? '',
        website: payload.website ?? '',
        addressLine1: payload.addressLine1 ?? '',
        addressLine2: payload.addressLine2 ?? '',
        seoDescription: payload.seoDescription ?? '',
        seoAuthor: payload.seoAuthor ?? '',
        seoImageUrl: payload.seoImageUrl ?? '',
        googleSiteVerification: payload.googleSiteVerification ?? '',
    }
}

const CompanyProfileSettings = () => {
    const { t } = useTranslation()
    const [initialValues, setInitialValues] = useState<CompanyProfileForm>(
        toFormValues(),
    )
    const [loading, setLoading] = useState(true)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [initialLogo, setInitialLogo] = useState<string | null>(null)
    const [logoAction, setLogoAction] = useState<'keep' | 'replace' | 'remove'>('keep')
    const [logoError, setLogoError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const validationSchema = useMemo(
        () =>
            Yup.object({
                legalName: Yup.string()
                    .trim()
                    .required(
                        t('validation.fieldRequired', {
                            field: t(
                                'settings.companyProfile.fields.legalName',
                                { defaultValue: 'Legal name' },
                            ),
                        }),
                    ),
                tradeName: Yup.string()
                    .trim()
                    .required(
                        t('validation.fieldRequired', {
                            field: t(
                                'settings.companyProfile.fields.tradeName',
                                { defaultValue: 'Trade name' },
                            ),
                        }),
                    ),
                taxId: Yup.string().trim().notRequired(),
                phone: Yup.string().trim().notRequired(),
                email: Yup.string()
                    .trim()
                    .test(
                        'valid-email',
                        t('validation.email', {
                            defaultValue: 'Enter a valid email address',
                        }),
                        (value) =>
                            !value ||
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
                    )
                    .notRequired(),
                website: Yup.string().trim().max(255).notRequired(),
                addressLine1: Yup.string().trim().notRequired(),
                addressLine2: Yup.string().trim().notRequired(),
                seoDescription: Yup.string().trim().max(320).notRequired(),
                seoAuthor: Yup.string().trim().max(120).notRequired(),
                seoImageUrl: Yup.string().trim().max(500).notRequired(),
                googleSiteVerification: Yup.string().trim().max(255).notRequired(),
            }),
        [t],
    )

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true)
            const res = await apiGetCompanyProfile<CompanyProfileResponse>()
            const formValues = toFormValues(res.data)
            setInitialValues(formValues)
            const logo = normalizeLogoData(res.data?.logo ?? null)
            setLogoPreview(logo)
            setInitialLogo(logo)
            setLogoAction('keep')
            setLogoError(null)
        } catch (error: any) {
            toast.push(
                <Notification
                    type="danger"
                    title={t('validation.failed', { defaultValue: 'Error' })}
                >
                    {error?.response?.data?.message ||
                        error?.message ||
                        String(error)}
                </Notification>,
            )
            setInitialValues(toFormValues())
            setLogoPreview(normalizeLogoData(DEFAULT_COMPANY_PROFILE.logo ?? null))
            setInitialLogo(normalizeLogoData(DEFAULT_COMPANY_PROFILE.logo ?? null))
            setLogoAction('keep')
            setLogoError(null)
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    const handleSelectLogo = () => {
        setLogoError(null)
        fileInputRef.current?.click()
    }

    const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null
        event.target.value = ''
        if (!file) {
            return
        }
        setLogoError(null)

        if (!ACCEPTED_LOGO_TYPES.includes(file.type as (typeof ACCEPTED_LOGO_TYPES)[number])) {
            setLogoError(
                t('settings.companyProfile.errors.logoUnsupported', {
                    defaultValue: 'Unsupported file format. Use PNG, JPG, WEBP or GIF.',
                }),
            )
            return
        }

        if (file.size === 0) {
            setLogoError(
                t('settings.companyProfile.errors.logoInvalid', {
                    defaultValue: 'Unable to read image file.',
                }),
            )
            return
        }

        if (file.size > MAX_LOGO_SIZE_BYTES) {
            setLogoError(
                t('settings.companyProfile.errors.logoTooLarge', {
                    defaultValue: 'Logo must not exceed 512 KB.',
                }),
            )
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : null
            if (!result) {
                setLogoError(
                    t('settings.companyProfile.errors.logoInvalid', {
                        defaultValue: 'Unable to read image file.',
                    }),
                )
                return
            }
            setLogoPreview(result)
            setLogoAction('replace')
        }
        reader.onerror = () => {
            setLogoError(
                t('settings.companyProfile.errors.logoInvalid', {
                    defaultValue: 'Unable to read image file.',
                }),
            )
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveLogo = () => {
        setLogoError(null)
        setLogoPreview(null)
        setLogoAction('remove')
    }

    const handleResetLogo = () => {
        setLogoError(null)
        setLogoPreview(initialLogo)
        setLogoAction('keep')
    }

    return (
        <Loading loading={loading}>
            <Card className="max-w-3xl">
                <h3 className="mb-2">
                    {t('settings.companyProfile.title', {
                        defaultValue: 'Company information',
                    })}
                </h3>
                <p className="mb-6 text-sm opacity-70">
                    {t('settings.companyProfile.subtitle', {
                        defaultValue:
                            'Customize the company data displayed on invoices and other documents.',
                    })}
                </p>
                <Formik
                    enableReinitialize
                    initialValues={initialValues}
                    validationSchema={validationSchema}
                    onSubmit={async (values, { setSubmitting, resetForm }) => {
                        try {
                            const trimmed = Object.fromEntries(
                                Object.entries(values).map(([key, value]) => [
                                    key,
                                    value.trim(),
                                ]),
                            ) as CompanyProfileForm
                            const payload: CompanyProfileUpdateRequest = {
                                legalName: trimmed.legalName,
                                tradeName: trimmed.tradeName,
                                taxId: trimmed.taxId.length ? trimmed.taxId : null,
                                email: trimmed.email.length ? trimmed.email : null,
                                phone: trimmed.phone.length ? trimmed.phone : null,
                                website: trimmed.website.length ? trimmed.website : null,
                                addressLine1: trimmed.addressLine1.length
                                    ? trimmed.addressLine1
                                    : null,
                                addressLine2: trimmed.addressLine2.length
                                    ? trimmed.addressLine2
                                    : null,
                                seoDescription: trimmed.seoDescription.length
                                    ? trimmed.seoDescription
                                    : null,
                                seoAuthor: trimmed.seoAuthor.length
                                    ? trimmed.seoAuthor
                                    : null,
                                seoImageUrl: trimmed.seoImageUrl.length
                                    ? trimmed.seoImageUrl
                                    : null,
                                googleSiteVerification:
                                    trimmed.googleSiteVerification.length
                                        ? trimmed.googleSiteVerification
                                        : null,
                            }
                            if (logoAction === 'replace' && logoPreview) {
                                payload.logo = logoPreview
                            } else if (logoAction === 'remove') {
                                payload.logo = null
                            }
                            const res = await apiUpdateCompanyProfile<
                                CompanyProfileResponse,
                                CompanyProfileUpdateRequest
                            >(payload)
                            toast.push(
                                <Notification
                                    type="success"
                                    title={t(
                                        'settings.companyProfile.updated.title',
                                    )}
                                >
                                    {t(
                                        'settings.companyProfile.updated.desc',
                                    )}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            const nextValues = toFormValues(res.data)
                            const nextLogo = normalizeLogoData(res.data?.logo)
                            setInitialValues(nextValues)
                            setLogoPreview(nextLogo)
                            setInitialLogo(nextLogo)
                            setLogoAction('keep')
                            setLogoError(null)
                            updateCompanyLogoCache(nextLogo ?? null)
                            resetForm({ values: nextValues })
                        } catch (error: any) {
                            toast.push(
                                <Notification
                                    type="danger"
                                    title={t('validation.failed', {
                                        defaultValue: 'Error',
                                    })}
                                >
                                    {error?.response?.data?.message ||
                                        error?.message ||
                                        String(error)}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ touched, errors, isSubmitting, resetForm }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t(
                                        'settings.companyProfile.fields.logo',
                                        { defaultValue: 'Logo' },
                                    )}
                                    invalid={Boolean(logoError)}
                                    errorMessage={logoError ?? undefined}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview}
                                                    alt={t(
                                                        'settings.companyProfile.fields.logo',
                                                        { defaultValue: 'Company logo' },
                                                    )}
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            ) : (
                                                <span className="text-xs text-gray-500 dark:text-gray-300">
                                                    {t(
                                                        'settings.companyProfile.labels.noLogo',
                                                        { defaultValue: 'No logo selected' },
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleSelectLogo}
                                            >
                                                {t(
                                                    'settings.companyProfile.actions.uploadLogo',
                                                    { defaultValue: 'Upload logo' },
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="twoTone"
                                                disabled={!logoPreview}
                                                onClick={handleRemoveLogo}
                                            >
                                                {t(
                                                    'settings.companyProfile.actions.removeLogo',
                                                    { defaultValue: 'Remove' },
                                                )}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="plain"
                                                disabled={logoAction === 'keep'}
                                                onClick={handleResetLogo}
                                            >
                                                {t(
                                                    'settings.companyProfile.actions.resetLogo',
                                                    { defaultValue: 'Reset' },
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={ACCEPTED_LOGO_TYPES.join(',')}
                                        className="hidden"
                                        onChange={handleLogoChange}
                                    />
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {t('settings.companyProfile.logoHint', {
                                            defaultValue:
                                                'PNG, JPG, WEBP or GIF up to 512 KB.',
                                        })}
                                    </p>
                                </FormItem>
                                <FormItem
                                    label={t(
                                        'settings.companyProfile.fields.legalName',
                                        { defaultValue: 'Legal name' },
                                    )}
                                    invalid={
                                        Boolean(
                                            errors.legalName &&
                                                touched.legalName,
                                        )
                                    }
                                    errorMessage={errors.legalName}
                                >
                                    <Field
                                        as={Input}
                                        name="legalName"
                                        placeholder={t(
                                            'settings.companyProfile.placeholders.legalName',
                                            {
                                                defaultValue:
                                                    'Sistema Administrativo, Inc.',
                                            },
                                        )}
                                    />
                                </FormItem>
                                <FormItem
                                    label={t(
                                        'settings.companyProfile.fields.tradeName',
                                        { defaultValue: 'Trade name' },
                                    )}
                                    invalid={
                                        Boolean(
                                            errors.tradeName &&
                                                touched.tradeName,
                                        )
                                    }
                                    errorMessage={errors.tradeName}
                                >
                                    <Field
                                        as={Input}
                                        name="tradeName"
                                        placeholder={t(
                                            'settings.companyProfile.placeholders.tradeName',
                                            {
                                                defaultValue:
                                                    'Sistema Administrativo',
                                            },
                                        )}
                                    />
                                </FormItem>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.taxId',
                                            { defaultValue: 'Tax ID' },
                                        )}
                                        invalid={Boolean(
                                            errors.taxId && touched.taxId,
                                        )}
                                        errorMessage={errors.taxId}
                                    >
                                        <Field
                                            as={Input}
                                            name="taxId"
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.taxId',
                                                {
                                                    defaultValue:
                                                        'RUC 1234567890',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.phone',
                                            { defaultValue: 'Phone' },
                                        )}
                                        invalid={Boolean(
                                            errors.phone && touched.phone,
                                        )}
                                        errorMessage={errors.phone}
                                    >
                                        <Field
                                            as={Input}
                                            name="phone"
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.phone',
                                                {
                                                    defaultValue:
                                                        '(123) 456-7890',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.email',
                                            { defaultValue: 'Email' },
                                        )}
                                        invalid={Boolean(
                                            errors.email && touched.email,
                                        )}
                                        errorMessage={errors.email}
                                    >
                                        <Field
                                            as={Input}
                                            name="email"
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.email',
                                                {
                                                    defaultValue:
                                                        'facturacion@sistemadministrativo.com',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.website',
                                            { defaultValue: 'Website' },
                                        )}
                                        invalid={Boolean(
                                            errors.website && touched.website,
                                        )}
                                        errorMessage={errors.website}
                                    >
                                        <Field
                                            as={Input}
                                            name="website"
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.website',
                                                {
                                                    defaultValue:
                                                        'www.sistemadministrativo.com',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                </div>
                                <FormItem
                                    label={t(
                                        'settings.companyProfile.fields.addressLine1',
                                        { defaultValue: 'Address line 1' },
                                    )}
                                    invalid={Boolean(
                                        errors.addressLine1 &&
                                            touched.addressLine1,
                                    )}
                                    errorMessage={errors.addressLine1}
                                >
                                    <Field
                                        as={Input}
                                        name="addressLine1"
                                        placeholder={t(
                                            'settings.companyProfile.placeholders.addressLine1',
                                            {
                                                defaultValue:
                                                    '9498 Harvard Street',
                                            },
                                        )}
                                    />
                                </FormItem>
                                <FormItem
                                    label={t(
                                        'settings.companyProfile.fields.addressLine2',
                                        { defaultValue: 'Address line 2' },
                                    )}
                                    invalid={Boolean(
                                        errors.addressLine2 &&
                                            touched.addressLine2,
                                    )}
                                    errorMessage={errors.addressLine2}
                                >
                                    <Field
                                        as={Input}
                                        name="addressLine2"
                                        placeholder={t(
                                            'settings.companyProfile.placeholders.addressLine2',
                                            {
                                                defaultValue:
                                                    'Fairfield, Chicago Town 06824',
                                            },
                                        )}
                                    />
                                </FormItem>
                                <div className="mt-2 rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700">
                                    <div className="mb-3">
                                        <h4 className="text-sm font-semibold">
                                            {t(
                                                'settings.companyProfile.seo.title',
                                                { defaultValue: 'SEO settings' },
                                            )}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'settings.companyProfile.seo.subtitle',
                                                {
                                                    defaultValue:
                                                        'These fields feed storefront metadata and are not shown on the public site.',
                                                },
                                            )}
                                        </p>
                                    </div>
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.seoDescription',
                                            { defaultValue: 'Meta description' },
                                        )}
                                        invalid={Boolean(
                                            errors.seoDescription &&
                                                touched.seoDescription,
                                        )}
                                        errorMessage={errors.seoDescription}
                                    >
                                        <Field
                                            as={Textarea}
                                            name="seoDescription"
                                            rows={4}
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.seoDescription',
                                                {
                                                    defaultValue:
                                                        'Short description used in search results.',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <FormItem
                                            label={t(
                                                'settings.companyProfile.fields.seoAuthor',
                                                { defaultValue: 'Author / brand' },
                                            )}
                                            invalid={Boolean(
                                                errors.seoAuthor &&
                                                    touched.seoAuthor,
                                            )}
                                            errorMessage={errors.seoAuthor}
                                        >
                                            <Field
                                                as={Input}
                                                name="seoAuthor"
                                                placeholder={t(
                                                    'settings.companyProfile.placeholders.seoAuthor',
                                                    {
                                                        defaultValue:
                                                            'Company or brand name',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                        <FormItem
                                            label={t(
                                                'settings.companyProfile.fields.googleSiteVerification',
                                                {
                                                    defaultValue:
                                                        'Google site verification',
                                                },
                                            )}
                                            invalid={Boolean(
                                                errors.googleSiteVerification &&
                                                    touched.googleSiteVerification,
                                            )}
                                            errorMessage={errors.googleSiteVerification}
                                        >
                                            <Field
                                                as={Input}
                                                name="googleSiteVerification"
                                                placeholder={t(
                                                    'settings.companyProfile.placeholders.googleSiteVerification',
                                                    {
                                                        defaultValue:
                                                            'google-site-verification token',
                                                    },
                                                )}
                                            />
                                        </FormItem>
                                    </div>
                                    <FormItem
                                        label={t(
                                            'settings.companyProfile.fields.seoImageUrl',
                                            { defaultValue: 'Open Graph image URL' },
                                        )}
                                        invalid={Boolean(
                                            errors.seoImageUrl &&
                                                touched.seoImageUrl,
                                        )}
                                        errorMessage={errors.seoImageUrl}
                                    >
                                        <Field
                                            as={Input}
                                            name="seoImageUrl"
                                            placeholder={t(
                                                'settings.companyProfile.placeholders.seoImageUrl',
                                                {
                                                    defaultValue:
                                                        'https://cdn.example.com/og/company.png',
                                                },
                                            )}
                                        />
                                    </FormItem>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="plain"
                                        onClick={() => {
                                            resetForm()
                                            setLogoPreview(initialLogo)
                                            setLogoAction('keep')
                                            setLogoError(null)
                                        }}
                                    >
                                        {t('text.actions.cancel', {
                                            defaultValue: 'Cancel',
                                        })}
                                    </Button>
                                    <Button
                                        loading={isSubmitting}
                                        type="submit"
                                        variant="solid"
                                    >
                                        {t('text.actions.save', {
                                            defaultValue: 'Save',
                                        })}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </Card>
        </Loading>
    )
}

export default CompanyProfileSettings
