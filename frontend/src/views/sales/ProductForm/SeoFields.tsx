import AdaptableCard from '@/components/shared/AdaptableCard'
import { FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import SeoImagePicker from '@/components/shared/SeoImagePicker'
import { useTranslation } from 'react-i18next'

type SeoFieldsProps = {
    values: {
        seoTitle?: string
        seoDescription?: string
        seoImageUrl?: string
        [key: string]: unknown
    }
    setFieldValue: (field: string, value: unknown) => void
}

const SeoFields = ({ values, setFieldValue }: SeoFieldsProps) => {
    const { t } = useTranslation()

    return (
        <AdaptableCard divider className="mb-4">
            <h5>{t('text.titles.seo', { defaultValue: 'SEO' })}</h5>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                {t('sales.productForm.seo.description', {
                    defaultValue: 'Metadata visible for search engines and social previews.',
                })}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem label={t('sales.productForm.seo.title', { defaultValue: 'SEO title' })}>
                    <Input
                        value={values.seoTitle ?? ''}
                        onChange={(event) => setFieldValue('seoTitle', event.target.value)}
                        placeholder={t('sales.productForm.seo.titlePlaceholder', {
                            defaultValue: 'Cortinas Roller | urucortinas',
                        })}
                    />
                </FormItem>
                <SeoImagePicker
                    label={t('sales.productForm.seo.imageUrl', { defaultValue: 'SEO image' })}
                    value={values.seoImageUrl ?? ''}
                    onChange={(nextValue) => setFieldValue('seoImageUrl', nextValue)}
                    helperText={t('sales.productForm.seo.imageHint', {
                        defaultValue: 'Choose a media asset from the CMS library.',
                    })}
                />
                <div className="md:col-span-2">
                    <FormItem
                        label={t('sales.productForm.seo.description', {
                            defaultValue: 'SEO description',
                        })}
                    >
                        <Textarea
                            rows={3}
                            value={values.seoDescription ?? ''}
                            onChange={(event) => setFieldValue('seoDescription', event.target.value)}
                            placeholder={t('sales.productForm.seo.descriptionPlaceholder', {
                                defaultValue: 'Short summary used on search results and previews.',
                            })}
                        />
                    </FormItem>
                </div>
            </div>
        </AdaptableCard>
    )
}

export default SeoFields
