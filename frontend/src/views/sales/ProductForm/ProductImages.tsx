import { useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import { FormItem } from '@/components/ui/Form'
import Dialog from '@/components/ui/Dialog'
import Upload from '@/components/ui/Upload'
import { HiEye, HiTrash } from 'react-icons/hi'
import cloneDeep from 'lodash/cloneDeep'
import { Field, FieldProps, FieldInputProps, FormikProps } from 'formik'
import { useTranslation } from 'react-i18next'

type Image = {
    id: string
    name: string
    img: string
}

type FormModel = {
    imgList: Image[]
    img?: string
    [key: string]: unknown
}

type ImageListProps = {
    imgList: Image[]
    coverImg?: string
    onImageDelete: (img: Image) => void
    onSetCover: (img: Image) => void
}

type ProductImagesProps = {
    values: FormModel
}

const ImageList = (props: ImageListProps) => {
    const { imgList, coverImg, onImageDelete, onSetCover } = props
    const { t } = useTranslation()

    const [selectedImg, setSelectedImg] = useState<Image>({} as Image)
    const [viewOpen, setViewOpen] = useState(false)
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)

    const onViewOpen = (img: Image) => {
        setSelectedImg(img)
        setViewOpen(true)
    }

    const onDialogClose = () => {
        setViewOpen(false)
        setTimeout(() => {
            setSelectedImg({} as Image)
        }, 300)
    }

    const onDeleteConfirmation = (img: Image) => {
        setSelectedImg(img)
        setDeleteConfirmationOpen(true)
    }

    const onDeleteConfirmationClose = () => {
        setSelectedImg({} as Image)
        setDeleteConfirmationOpen(false)
    }

    const onDelete = () => {
        onImageDelete?.(selectedImg)
        setDeleteConfirmationOpen(false)
    }

    return (
        <>
            {imgList.map((img) => {
                const isCover = coverImg === img.img
                return (
                    <div
                        key={img.id}
                        className="group relative rounded-sm border p-2 flex"
                    >
                        <img
                            className="rounded-sm max-h-[140px] max-w-full"
                            src={img.img}
                            alt={img.name}
                        />
                        {isCover && (
                            <span className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-0.5 rounded">
                                {t('sales.productForm.images.cover')}
                            </span>
                        )}
                        <div className="absolute inset-2 bg-gray-900/[.7] group-hover:flex hidden flex-col items-center justify-center gap-3 text-sm">
                            <div className="flex items-center text-xl">
                                <span
                                    className="text-gray-100 hover:text-gray-300 cursor-pointer p-1.5"
                                    onClick={() => onViewOpen(img)}
                                >
                                    <HiEye />
                                </span>
                                <span
                                    className="text-gray-100 hover:text-gray-300 cursor-pointer p-1.5"
                                    onClick={() => onDeleteConfirmation(img)}
                                >
                                    <HiTrash />
                                </span>
                            </div>
                            {!isCover && (
                                <button
                                    type="button"
                                    className="text-xs font-semibold text-white hover:text-gray-200 underline"
                                    onClick={() => onSetCover(img)}
                                >
                                    {t('sales.productForm.images.setCover')}
                                </button>
                            )}
                        </div>
                    </div>
                )
            })}
            <Dialog
                isOpen={viewOpen}
                onClose={onDialogClose}
                onRequestClose={onDialogClose}
            >
                <h5 className="mb-4">{selectedImg.name}</h5>
                <img
                    className="w-full"
                    src={selectedImg.img}
                    alt={selectedImg.name}
                />
            </Dialog>
            <ConfirmDialog
                isOpen={deleteConfirmationOpen}
                type="danger"
                title={t('text.actions.remove')}
                confirmButtonColor="red-600"
                onClose={onDeleteConfirmationClose}
                onRequestClose={onDeleteConfirmationClose}
                onCancel={onDeleteConfirmationClose}
                onConfirm={onDelete}
            >
                <p>{t('sales.productForm.images.removeConfirm')}</p>
            </ConfirmDialog>
        </>
    )
}

const ProductImages = (props: ProductImagesProps) => {
    const { values } = props
    const { t } = useTranslation()

    const beforeUpload = (file: FileList | null) => {
        let valid: boolean | string = true

        const allowedFileType = ['image/jpeg', 'image/png']
        const maxFileSize = 500000

        if (file) {
            for (const f of file) {
                if (!allowedFileType.includes(f.type)) {
                    valid = t('sales.productForm.images.invalidType')
                }

                if (f.size >= maxFileSize) {
                    valid = t('sales.productForm.images.invalidSize')
                }
            }
        }

        return valid
    }

    const fileToDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })

    const onUpload = async (
        form: FormikProps<FormModel>,
        field: FieldInputProps<FormModel>,
        files: File[],
    ) => {
        const currentList = values.imgList || []
        const newCount = files.length - currentList.length
        if (newCount <= 0) {
            form.setFieldValue(field.name, currentList)
            return
        }
        const newFiles = files.slice(-newCount)
        const dataUrls = await Promise.all(newFiles.map((f) => fileToDataUrl(f)))

        const nextIndexStart = currentList.length
        const newImages = dataUrls.map((img, idx) => ({
            id: `${Date.now()}-${nextIndexStart + idx}`,
            name: newFiles[idx].name,
            img,
        }))

        const imageList = [...currentList, ...newImages]
        form.setFieldValue(field.name, imageList)
        const currentCover = form.values.img as string | undefined
        const hasCover = currentCover && imageList.some((im) => im.img === currentCover)
        if (!hasCover) {
            form.setFieldValue('img', imageList[0]?.img || '')
        }
    }

    const handleImageDelete = (
        form: FormikProps<FormModel>,
        field: FieldInputProps<FormModel>,
        deletedImg: Image,
    ) => {
        let imgList = cloneDeep(values.imgList || [])
        imgList = imgList.filter((img) => img.id !== deletedImg.id)
        form.setFieldValue(field.name, imgList)
        const currentCover = form.values.img as string | undefined
        if (!imgList.length) {
            form.setFieldValue('img', '')
        } else if (currentCover === deletedImg.img || !imgList.some((img) => img.img === currentCover)) {
            form.setFieldValue('img', imgList[0].img)
        }
    }

    return (
        <AdaptableCard className="mb-4">
            <h5>{t('sales.productForm.images.title')}</h5>
            <p className="mb-6">{t('sales.productForm.images.desc')}</p>
            <FormItem>
                <Field name="imgList">
                    {({ field, form }: FieldProps) => {
                        const currentList = values.imgList || []
                        if (currentList.length > 0) {
                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                    <ImageList
                                        imgList={currentList}
                                        coverImg={values.img as string | undefined}
                                        onImageDelete={(img: Image) =>
                                            handleImageDelete(form, field, img)
                                        }
                                        onSetCover={(img: Image) =>
                                            form.setFieldValue('img', img.img)
                                        }
                                    />
                                    <Upload
                                        draggable
                                        multiple
                                        accept="image/*"
                                        className="min-h-fit"
                                        beforeUpload={beforeUpload}
                                        showList={false}
                                        onChange={(files) =>
                                            onUpload(form, field, files)
                                        }
                                    >
                                        <div className="max-w-full flex flex-col px-4 py-2 justify-center items-center">
                                            <DoubleSidedImage
                                                src="/img/others/upload.png"
                                                darkModeSrc="/img/others/upload-dark.png"
                                            />
                                            <p className="font-semibold text-center text-gray-800 dark:text-white">{t('sales.productForm.images.upload')}</p>
                                        </div>
                                    </Upload>
                                </div>
                            )
                        }

                        return (
                            <Upload
                                draggable
                                multiple
                                accept="image/*"
                                beforeUpload={beforeUpload}
                                showList={false}
                                onChange={(files) =>
                                    onUpload(form, field, files)
                                }
                            >
                                <div className="my-16 text-center">
                                    <DoubleSidedImage
                                        className="mx-auto"
                                        src="/img/others/upload.png"
                                        darkModeSrc="/img/others/upload-dark.png"
                                    />
                                    <p className="font-semibold">
                                        <span className="text-gray-800 dark:text-white">{t('sales.productForm.images.dropHere')} </span>
                                        <span className="text-blue-500">{t('sales.productForm.images.browse')}</span>
                                    </p>
                                    <p className="mt-1 opacity-60 dark:text-white">{t('sales.productForm.images.support')}</p>
                                </div>
                            </Upload>
                        )
                    }}
                </Field>
            </FormItem>
        </AdaptableCard>
    )
}

export default ProductImages
