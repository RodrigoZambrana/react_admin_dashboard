import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Upload from '@/components/ui/Upload'
import { FormItem } from '@/components/ui/Form'
import { HiUserCircle, HiMail, HiPhone, HiOutlineUser } from 'react-icons/hi'
import { Field, FieldArray, FieldProps, getIn, useFormikContext } from 'formik'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import type { FormModel } from './CustomerForm'

const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })

const PersonalInfoForm = () => {
    const { t } = useTranslation()
    const { values, errors, touched } = useFormikContext<FormModel>()
    const phoneNumbers = values.phoneNumbers || ['']

    const translateError = (message?: string) => {
        if (typeof message !== 'string' || message.trim().length === 0) {
            return undefined
        }
        return t(message, { defaultValue: message })
    }

    return (
        <>
            <FormItem
                invalid={Boolean((errors as any)?.upload && (touched as any)?.upload)}
                errorMessage={(errors as any)?.upload}
            >
                <Field name="img">
                    {({ field, form }: FieldProps) => {
                        const avatarProps = field.value
                            ? { src: field.value }
                            : {}
                        return (
                            <div className="flex justify-center">
                                <Upload
                                    className="cursor-pointer"
                                    showList={false}
                                    uploadLimit={1}
                                    onChange={async (files) => {
                                        const file = files[0]
                                        if (!file) return
                                        try {
                                            const dataUrl = await fileToDataUrl(file)
                                            form.setFieldValue(field.name, dataUrl)
                                        } catch (error) {
                                            console.error('Failed to read image file', error)
                                        }
                                    }}
                                    onFileRemove={() =>
                                        form.setFieldValue(field.name, '')
                                    }
                                >
                                    <Avatar
                                        className="border-2 border-white dark:border-gray-800 shadow-lg"
                                        size={100}
                                        shape="circle"
                                        icon={<HiOutlineUser />}
                                        {...avatarProps}
                                    />
                                </Upload>
                            </div>
                        )
                    }}
                </Field>
            </FormItem>
            <FormItem
                label={t('text.labels.firstName')}
                invalid={Boolean((touched as any).firstName && (errors as any).firstName)}
                errorMessage={(errors as any).firstName}
            >
                <Field
                    type="text"
                    autoComplete="off"
                    name="firstName"
                    placeholder={t('text.placeholders.name')}
                    component={Input}
                    prefix={<HiUserCircle className="text-xl" />}
                />
            </FormItem>
            <FormItem
                label={t('text.labels.lastName')}
                invalid={Boolean((touched as any).lastName && (errors as any).lastName)}
                errorMessage={(errors as any).lastName}
            >
                <Field
                    type="text"
                    autoComplete="off"
                    name="lastName"
                    placeholder={t('text.placeholders.lastName')}
                    component={Input}
                    prefix={<HiUserCircle className="text-xl" />}
                />
            </FormItem>
            <FormItem
                label={t('text.labels.email')}
                invalid={Boolean((touched as any).email && (errors as any).email)}
                errorMessage={(errors as any).email}
            >
                <Field
                    type="email"
                    autoComplete="off"
                    name="email"
                    placeholder={t('text.labels.email')}
                    component={Input}
                    prefix={<HiMail className="text-xl" />}
                />
            </FormItem>
            <FieldArray name="phoneNumbers">
                {({ push, remove }) => (
                    <div className="flex flex-col gap-3">
                        {phoneNumbers.map((_, index) => {
                            const arrayError =
                                typeof (errors as any)?.phoneNumbers === 'string'
                                    ? (errors as any).phoneNumbers
                                    : undefined
                            const arrayTouched = Array.isArray((touched as any)?.phoneNumbers)
                                ? (touched as any).phoneNumbers.some(Boolean)
                                : Boolean((touched as any)?.phoneNumbers)
                            const fieldError = getIn(errors, `phoneNumbers.${index}`)
                            const fieldTouched = getIn(touched, `phoneNumbers.${index}`)
                            let error: string | undefined
                            let isTouched: boolean | undefined

                            if (index === 0 && arrayError) {
                                error = arrayError
                                isTouched = arrayTouched
                            } else {
                                error = fieldError
                                isTouched = fieldTouched
                            }
                            return (
                                <FormItem
                                    key={index}
                                    label={index === 0 ? t('text.labels.phoneNumber') : undefined}
                                    invalid={Boolean(isTouched && error)}
                                    errorMessage={
                                        index === 0 && arrayError
                                            ? undefined
                                            : translateError(error)
                                    }
                                >
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Field name={`phoneNumbers.${index}`}>
                                            {({ field }: FieldProps<string>) => (
                                                <Input
                                                    {...field}
                                                    placeholder={t('text.labels.phoneNumber')}
                                                    prefix={<HiPhone className="text-xl" />}
                                                />
                                            )}
                                        </Field>
                                        <div className="flex sm:items-center gap-2">
                                            {phoneNumbers.length > 1 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => remove(index)}
                                                >
                                                    {t('text.actions.remove')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {index === 0 &&
                                        typeof arrayError === 'string' &&
                                        (isTouched as boolean | undefined) && (
                                            <span className="text-xs text-red-500">
                                                {translateError(arrayError)}
                                            </span>
                                        )}
                                </FormItem>
                            )
                        })}
                        <div>
                            <Button
                                type="button"
                                size="sm"
                                variant="twoTone"
                                onClick={() => push('')}
                            >
                                {t('text.actions.addMore')}
                            </Button>
                        </div>
                    </div>
                )}
            </FieldArray>
        </>
    )
}

export default PersonalInfoForm
