import { useEffect, useMemo, useState } from 'react'
import Select from '@/components/ui/Select'
import { FormItem } from '@/components/ui/Form'
import Notification from '@/components/ui/Notification'
import CmsPagesService, { type CmsPageMedia } from '@/services/CmsPagesService'
import { useTranslation } from 'react-i18next'

type Option = {
    value: string
    label: string
}

type SeoImagePickerProps = {
    label: string
    value?: string | null
    onChange: (nextValue: string) => void
    helperText?: string
}

const labelForMedia = (item: CmsPageMedia) =>
    item.title?.trim() ||
    item.alt?.trim() ||
    item.fileName?.trim() ||
    item.url

const SeoImagePicker = ({ label, value, onChange, helperText }: SeoImagePickerProps) => {
    const { t } = useTranslation()
    const [mediaItems, setMediaItems] = useState<CmsPageMedia[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let ignore = false
        const load = async () => {
            setLoading(true)
            try {
                const response = await CmsPagesService.listMedia({
                    isActive: true,
                })
                if (ignore) {
                    return
                }
                setMediaItems(Array.isArray(response.data) ? response.data : [])
            } catch {
                if (!ignore) {
                    setMediaItems([])
                }
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }
        load()
        return () => {
            ignore = true
        }
    }, [])

    const options = useMemo<Option[]>(
        () => [
            { value: '', label: t('common.none', { defaultValue: 'Sin imagen' }) },
            ...mediaItems.map((item) => ({
                value: item.url,
                label: labelForMedia(item),
            })),
        ],
        [mediaItems, t],
    )

    const selected = options.find((option) => option.value === (value ?? '')) ?? options[0]
    const selectedMedia = mediaItems.find((item) => item.url === value) ?? null

    return (
        <FormItem label={label}>
            <Select<Option>
                options={options}
                value={selected}
                isLoading={loading}
                onChange={(option) => onChange((option as Option | null)?.value ?? '')}
            />
            {helperText ? <p className="text-xs text-gray-500 mt-1">{helperText}</p> : null}
            {selectedMedia ? (
                <div className="mt-3 rounded border border-gray-200 dark:border-gray-700 p-2">
                    <div className="text-xs text-gray-500 mb-2">
                        {t('common.preview', { defaultValue: 'Preview' })}
                    </div>
                    <img
                        src={selectedMedia.url}
                        alt={selectedMedia.alt ?? selectedMedia.title ?? 'SEO image'}
                        className="max-h-32 rounded object-contain bg-white dark:bg-gray-900"
                    />
                </div>
            ) : value ? (
                <Notification type="warning" title={t('common.warning', { defaultValue: 'Warning' })}>
                    {t('common.noMediaMatch', {
                        defaultValue: 'The current value is not present in the media library.',
                    })}
                </Notification>
            ) : null}
        </FormItem>
    )
}

export default SeoImagePicker
