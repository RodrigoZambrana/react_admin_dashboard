import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import Card from '@/components/ui/Card'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Upload from '@/components/ui/Upload'
import { HiOutlinePhotograph } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import {
    apiCreateShippingOption,
    apiDeleteShippingOption,
    apiGetShippingOptions,
    apiUpdateShippingOption,
} from '@/services/SettingsService'

type ShippingOption = {
    id: number
    name: string
    deliveryFees: number | null
    estimatedMin: number | null
    estimatedMax: number | null
    img?: string | null
}

type FormState = {
    name: string
    deliveryFees: string
    estimatedMin: string
    estimatedMax: string
    img: string
    imgFile: File | null
    imgPreview: string
}

const buildEmptyState = (): FormState => ({
    name: '',
    deliveryFees: '',
    estimatedMin: '',
    estimatedMax: '',
    img: '',
    imgFile: null,
    imgPreview: '',
})

const revokeObjectUrl = (ref: MutableRefObject<string | null>) => {
    if (ref.current) {
        URL.revokeObjectURL(ref.current)
        ref.current = null
    }
}

const { Tr, Td, TBody, THead, Th } = Table

const ShippingOptions = () => {
    const { t } = useTranslation()
    const [items, setItems] = useState<ShippingOption[]>([])
    const [form, setForm] = useState<FormState>(() => buildEmptyState())
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingValues, setEditingValues] = useState<FormState>(() => buildEmptyState())
    const formPreviewRef = useRef<string | null>(null)
    const editPreviewRef = useRef<string | null>(null)

    const fetch = async () => {
        const res = await apiGetShippingOptions<ShippingOption[]>()
        const data = (res.data as unknown as ShippingOption[]) || []
        setItems(data)
    }

    useEffect(() => {
        fetch()
    }, [])

    useEffect(() => () => {
        revokeObjectUrl(formPreviewRef)
        revokeObjectUrl(editPreviewRef)
    }, [])

    const resetForm = () => {
        revokeObjectUrl(formPreviewRef)
        setForm(buildEmptyState())
    }

    const resetEditing = () => {
        revokeObjectUrl(editPreviewRef)
        setEditingId(null)
        setEditingValues(buildEmptyState())
    }

    const toNumber = (value: string, fallback = 0) => {
        if (value === null || value === undefined || value === '') {
            return fallback
        }
        const num = Number(value)
        return Number.isFinite(num) ? num : fallback
    }

    const setFormImageFile = (file: File | null) => {
        revokeObjectUrl(formPreviewRef)
        if (file) {
            const previewUrl = URL.createObjectURL(file)
            formPreviewRef.current = previewUrl
            setForm((prev) => ({
                ...prev,
                imgFile: file,
                imgPreview: previewUrl,
                img: '',
            }))
        } else {
            setForm((prev) => ({
                ...prev,
                imgFile: null,
                imgPreview: '',
                img: '',
            }))
        }
    }

    const setEditingImageFile = (file: File | null) => {
        revokeObjectUrl(editPreviewRef)
        if (file) {
            const previewUrl = URL.createObjectURL(file)
            editPreviewRef.current = previewUrl
            setEditingValues((prev) => ({
                ...prev,
                imgFile: file,
                imgPreview: previewUrl,
            }))
        } else {
            setEditingValues((prev) => ({
                ...prev,
                imgFile: null,
                imgPreview: '',
            }))
        }
    }

    const handleFormUploadChange = (files: File[]) => {
        setFormImageFile(files[0] ?? null)
    }

    const handleEditUploadChange = (files: File[]) => {
        setEditingImageFile(files[0] ?? null)
    }

    const handleFormImageInputChange = (value: string) => {
        revokeObjectUrl(formPreviewRef)
        setForm((prev) => ({
            ...prev,
            img: value,
            imgFile: null,
            imgPreview: '',
        }))
    }

    const handleEditImageInputChange = (value: string) => {
        revokeObjectUrl(editPreviewRef)
        setEditingValues((prev) => ({
            ...prev,
            img: value,
            imgFile: null,
            imgPreview: '',
        }))
    }

    const handleFormImageClear = () => {
        setFormImageFile(null)
    }

    const handleEditImageRemove = () => {
        const hadPreview = Boolean(editingValues.imgPreview)
        setEditingImageFile(null)
        if (!hadPreview) {
            setEditingValues((prev) => ({
                ...prev,
                img: '',
            }))
        }
    }

    const onAdd = async () => {
        const name = form.name.trim()
        if (!name) {
            return
        }
        setLoading(true)
        const basePayload = {
            name,
            deliveryFees: toNumber(form.deliveryFees, 0),
            estimatedMin: toNumber(form.estimatedMin, 0),
            estimatedMax: toNumber(form.estimatedMax || form.estimatedMin, toNumber(form.estimatedMin, 0)),
        }

        try {
            let res
            if (form.imgFile) {
                const data = new FormData()
                data.append('name', basePayload.name)
                data.append('deliveryFees', String(basePayload.deliveryFees))
                data.append('estimatedMin', String(basePayload.estimatedMin))
                data.append('estimatedMax', String(basePayload.estimatedMax))
                data.append('logo', form.imgFile)
                if (form.img.trim()) {
                    data.append('img', form.img.trim())
                }
                res = await apiCreateShippingOption<boolean, FormData>(data)
            } else {
                const payload = {
                    ...basePayload,
                    img: form.img.trim() ? form.img.trim() : null,
                }
                res = await apiCreateShippingOption<boolean, typeof payload>(payload)
            }
            if (res.data) {
                toast.push(
                    <Notification title={t('settings.shippingOptions.created.title')} type="success">
                        {t('settings.shippingOptions.created.desc')}
                    </Notification>,
                )
                resetForm()
                fetch()
            }
        } finally {
            setLoading(false)
        }
    }

    const onEdit = (option: ShippingOption) => {
        revokeObjectUrl(editPreviewRef)
        setEditingId(option.id)
        setEditingValues({
            name: option.name ?? '',
            deliveryFees: option.deliveryFees !== null && option.deliveryFees !== undefined ? String(option.deliveryFees) : '',
            estimatedMin: option.estimatedMin !== null && option.estimatedMin !== undefined ? String(option.estimatedMin) : '',
            estimatedMax: option.estimatedMax !== null && option.estimatedMax !== undefined ? String(option.estimatedMax) : '',
            img: option.img ?? '',
            imgFile: null,
            imgPreview: '',
        })
    }

    const onCancel = () => {
        resetEditing()
    }

    const onUpdate = async () => {
        if (editingId === null) {
            return
        }
        const basePayload = {
            id: editingId,
            name: editingValues.name.trim(),
            deliveryFees: toNumber(editingValues.deliveryFees, 0),
            estimatedMin: toNumber(editingValues.estimatedMin, 0),
            estimatedMax: toNumber(
                editingValues.estimatedMax || editingValues.estimatedMin,
                toNumber(editingValues.estimatedMin, 0),
            ),
        }

        let res
        if (editingValues.imgFile) {
            const data = new FormData()
            data.append('id', String(basePayload.id))
            data.append('name', basePayload.name)
            data.append('deliveryFees', String(basePayload.deliveryFees))
            data.append('estimatedMin', String(basePayload.estimatedMin))
            data.append('estimatedMax', String(basePayload.estimatedMax))
            data.append('logo', editingValues.imgFile)
            if (editingValues.img.trim()) {
                data.append('img', editingValues.img.trim())
            }
            res = await apiUpdateShippingOption<boolean, FormData>(data)
        } else {
            const payload = {
                ...basePayload,
                img: editingValues.img.trim() ? editingValues.img.trim() : null,
            }
            res = await apiUpdateShippingOption<boolean, typeof payload>(payload)
        }

        if (res.data) {
            toast.push(
                <Notification title={t('settings.shippingOptions.updated.title')} type="success">
                    {t('settings.shippingOptions.updated.desc')}
                </Notification>,
            )
            resetEditing()
            fetch()
        }
    }

    const onDelete = async (id: number) => {
        const res = await apiDeleteShippingOption<boolean, { id: number }>({ id })
        if (res.data) {
            toast.push(
                <Notification title={t('settings.shippingOptions.deleted.title')} type="success">
                    {t('settings.shippingOptions.deleted.desc')}
                </Notification>,
            )
            fetch()
        }
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <Card className="card-shadow">
                <h4 className="mb-4">{t('settings.shippingOptions.title')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <Input
                        value={form.name}
                        placeholder={t('settings.shippingOptions.placeholders.name')}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                        value={form.deliveryFees}
                        placeholder={t('settings.shippingOptions.placeholders.deliveryFees')}
                        type="number"
                        step="0.01"
                        onChange={(e) => setForm((prev) => ({ ...prev, deliveryFees: e.target.value }))}
                    />
                    <Input
                        value={form.estimatedMin}
                        placeholder={t('settings.shippingOptions.placeholders.estimatedMin')}
                        type="number"
                        onChange={(e) => setForm((prev) => ({ ...prev, estimatedMin: e.target.value }))}
                    />
                    <Input
                        value={form.estimatedMax}
                        placeholder={t('settings.shippingOptions.placeholders.estimatedMax')}
                        type="number"
                        onChange={(e) => setForm((prev) => ({ ...prev, estimatedMax: e.target.value }))}
                    />
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Upload
                                className="cursor-pointer shrink-0"
                                showList={false}
                                uploadLimit={1}
                                onChange={(files) => handleFormUploadChange(files as File[])}
                                onFileRemove={(files) => handleFormUploadChange(files as File[])}
                            >
                                <Avatar
                                    shape="circle"
                                    size={56}
                                    src={
                                        form.imgPreview ||
                                        (form.img.trim() ? form.img.trim() : undefined)
                                    }
                                >
                                    {form.name.trim()
                                        ? form.name.trim().charAt(0)
                                        : <HiOutlinePhotograph className="text-lg" />}
                                </Avatar>
                            </Upload>
                            {(form.imgPreview || form.img.trim()) && (
                                <Button size="xs" type="button" onClick={handleFormImageClear}>
                                    {t('text.actions.remove')}
                                </Button>
                            )}
                        </div>
                        <Input
                            value={form.img}
                            placeholder={t('settings.shippingOptions.placeholders.img')}
                            onChange={(e) => handleFormImageInputChange(e.target.value)}
                        />
                        <div className="flex justify-end md:justify-start">
                            <Button loading={loading} variant="solid" onClick={onAdd}>
                                {t('text.actions.add')}
                            </Button>
                        </div>
                    </div>
                </div>
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t('settings.shippingOptions.columns.image')}</Th>
                            <Th>{t('settings.shippingOptions.columns.name')}</Th>
                            <Th>{t('settings.shippingOptions.columns.deliveryFees')}</Th>
                            <Th>{t('settings.shippingOptions.columns.estimatedMin')}</Th>
                            <Th>{t('settings.shippingOptions.columns.estimatedMax')}</Th>
                            <Th className="text-right">{t('text.columns.actions')}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {items.map((option) => {
                            const isEditing = editingId === option.id
                            return (
                                <Tr key={option.id}>
                                    <Td>
                                        {isEditing ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Upload
                                                        className="cursor-pointer shrink-0"
                                                        showList={false}
                                                        uploadLimit={1}
                                                        onChange={(files) => handleEditUploadChange(files as File[])}
                                                        onFileRemove={(files) => handleEditUploadChange(files as File[])}
                                                    >
                                                        <Avatar
                                                            shape="circle"
                                                            size={56}
                                                            src={
                                                                editingValues.imgPreview ||
                                                                (editingValues.img.trim()
                                                                    ? editingValues.img.trim()
                                                                    : undefined)
                                                            }
                                                        >
                                                            {option.name.trim()
                                                                ? option.name.trim().charAt(0)
                                                                : <HiOutlinePhotograph className="text-lg" />}
                                                        </Avatar>
                                                    </Upload>
                                                    {(editingValues.imgPreview || editingValues.img.trim()) && (
                                                        <Button size="xs" type="button" onClick={handleEditImageRemove}>
                                                            {t('text.actions.remove')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <Input
                                                    value={editingValues.img}
                                                    placeholder={t('settings.shippingOptions.placeholders.img')}
                                                    onChange={(e) => handleEditImageInputChange(e.target.value)}
                                                />
                                            </div>
                                        ) : (
                                            <Avatar shape="circle" src={option.img || undefined}>
                                                {option.name.charAt(0)}
                                            </Avatar>
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Input
                                                value={editingValues.name}
                                                onChange={(e) =>
                                                    setEditingValues((prev) => ({
                                                        ...prev,
                                                        name: e.target.value,
                                                    }))
                                                }
                                            />
                                        ) : (
                                            option.name
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={editingValues.deliveryFees}
                                                onChange={(e) =>
                                                    setEditingValues((prev) => ({
                                                        ...prev,
                                                        deliveryFees: e.target.value,
                                                    }))
                                                }
                                            />
                                        ) : (
                                            toNumber(String(option.deliveryFees ?? 0)).toFixed(2)
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                value={editingValues.estimatedMin}
                                                onChange={(e) =>
                                                    setEditingValues((prev) => ({
                                                        ...prev,
                                                        estimatedMin: e.target.value,
                                                    }))
                                                }
                                            />
                                        ) : (
                                            option.estimatedMin ?? 0
                                        )}
                                    </Td>
                                    <Td>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                value={editingValues.estimatedMax}
                                                onChange={(e) =>
                                                    setEditingValues((prev) => ({
                                                        ...prev,
                                                        estimatedMax: e.target.value,
                                                    }))
                                                }
                                            />
                                        ) : (
                                            option.estimatedMax ?? option.estimatedMin ?? 0
                                        )}
                                    </Td>
                                    <Td className="text-right">
                                        {isEditing ? (
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="twoTone" onClick={onUpdate}>
                                                    {t('text.actions.save')}
                                                </Button>
                                                <Button size="sm" onClick={onCancel}>
                                                    {t('text.actions.cancel')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" onClick={() => onEdit(option)}>
                                                    {t('text.actions.edit')}
                                                </Button>
                                                <Button size="sm" color="red-600" onClick={() => onDelete(option.id)}>
                                                    {t('text.actions.delete')}
                                                </Button>
                                            </div>
                                        )}
                                    </Td>
                                </Tr>
                            )
                        })}
                    </TBody>
                </Table>
            </Card>
        </div>
    )
}

export default ShippingOptions
