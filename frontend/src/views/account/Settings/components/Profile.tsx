import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Upload from '@/components/ui/Upload'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { FormContainer } from '@/components/ui/Form'
import FormDesription from './FormDesription'
import FormRow from './FormRow'
import { Field, Form, Formik } from 'formik'
import { components } from 'react-select'
import {
    HiOutlineUserCircle,
    HiOutlineMail,
    HiOutlineUser,
    HiCheck,
} from 'react-icons/hi'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { setLang, useAppDispatch, useAppSelector } from '@/store'
import type { OptionProps, ControlProps } from 'react-select'
import type { FormikProps, FieldInputProps, FieldProps } from 'formik'

export type ProfileFormModel = {
    firstName: string
    lastName: string
    email: string
    avatar: string
    lang: string
}

type ProfileProps = {
    data?: Partial<ProfileFormModel> & { name?: string }
}

type LanguageOption = {
    value: string
    label: string
    imgPath: string
}

const { Control } = components

const validationSchema = Yup.object().shape({
    firstName: Yup.string()
        .min(2, 'text.validation.tooShort')
        .max(24, 'text.validation.tooLong')
        .required('text.validation.userNameRequired'),
    lastName: Yup.string().max(24, 'text.validation.tooLong'),
    email: Yup.string()
        .email('text.validation.invalidEmail')
        .required('text.validation.emailRequired'),
    avatar: Yup.string(),
    lang: Yup.string(),
})

const langOptions: LanguageOption[] = [
    { value: 'en', label: 'English', imgPath: '/img/countries/us.png' },
    { value: 'es', label: 'Español', imgPath: '/img/countries/sp.png' },
]

const CustomSelectOption = ({
    innerProps,
    label,
    data,
    isSelected,
}: OptionProps<LanguageOption>) => {
    return (
        <div
            className={`flex items-center justify-between p-2 ${
                isSelected
                    ? 'bg-gray-100 dark:bg-gray-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            {...innerProps}
        >
            <div className="flex items-center">
                <Avatar shape="circle" size={20} src={data.imgPath} />
                <span className="ml-2 rtl:mr-2">{label}</span>
            </div>
            {isSelected && <HiCheck className="text-emerald-500 text-xl" />}
        </div>
    )
}

const CustomControl = ({
    children,
    ...props
}: ControlProps<LanguageOption>) => {
    const selected = props.getValue()[0]
    return (
        <Control {...props}>
            {selected && (
                <Avatar
                    className="ltr:ml-4 rtl:mr-4"
                    shape="circle"
                    size={18}
                    src={selected.imgPath}
                />
            )}
            {children}
        </Control>
    )
}

const splitName = (name?: string) => {
    if (!name) {
        return { firstName: '', lastName: '' }
    }
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' }
    }
    return {
        firstName: parts.shift() || '',
        lastName: parts.join(' '),
    }
}

const Profile = ({ data = {} }: ProfileProps) => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const currentLang = useAppSelector((state) => state.locale.currentLang)

    const { firstName, lastName } = splitName(data.name)

    const onSetFormFile = (
        form: FormikProps<ProfileFormModel>,
        field: FieldInputProps<ProfileFormModel>,
        file: File[],
    ) => {
        if (file.length) {
            form.setFieldValue(field.name, URL.createObjectURL(file[0]))
        } else {
            form.setFieldValue(field.name, '')
        }
    }

    const onFormSubmit = (
        values: ProfileFormModel,
        setSubmitting: (isSubmitting: boolean) => void,
    ) => {
        dispatch(setLang(values.lang))
        i18n.changeLanguage(values.lang)
        const payload = {
            ...values,
            name: [values.firstName, values.lastName].filter(Boolean).join(' '),
        }
        console.log('profile values', payload)
        toast.push(
            <Notification
                title={t('account.settings.profile.profileUpdated')}
                type="success"
            />,
            {
                placement: 'top-center',
            },
        )
        setSubmitting(false)
    }

    const normalizedLang = (currentLang || i18n.language || 'en')
        .toLowerCase()
        .startsWith('es')
        ? 'es'
        : 'en'

    return (
        <Formik
            enableReinitialize
            initialValues={{
                firstName: data.firstName || firstName,
                lastName: data.lastName || lastName,
                email: data.email || '',
                avatar: data.avatar || '',
                lang: data.lang || normalizedLang,
            }}
            validationSchema={validationSchema}
            onSubmit={(values, { setSubmitting }) => {
                setSubmitting(true)
                setTimeout(() => {
                    onFormSubmit(values, setSubmitting)
                }, 600)
            }}
        >
            {({ values, touched, errors, isSubmitting, resetForm, setFieldValue }) => {
                const validatorProps = { touched, errors }
                return (
                    <Form>
                        <FormContainer>
                            <FormDesription
                                title={t('account.settings.profile.general')}
                                desc={t('account.settings.profile.generalDesc')}
                            />
                            <FormRow
                                name="avatar"
                                label="Avatar"
                                {...validatorProps}
                            >
                                <Field name="avatar">
                                    {({ field, form }: FieldProps) => {
                                        const avatarProps = field.value
                                            ? { src: field.value }
                                            : {}
                                        return (
                                            <Upload
                                                className="cursor-pointer"
                                                showList={false}
                                                uploadLimit={1}
                                                onChange={(files) =>
                                                    onSetFormFile(
                                                        form,
                                                        field,
                                                        files,
                                                    )
                                                }
                                                onFileRemove={(files) =>
                                                    onSetFormFile(
                                                        form,
                                                        field,
                                                        files,
                                                    )
                                                }
                                            >
                                                <Avatar
                                                    className="border-2 border-white dark:border-gray-800 shadow-lg"
                                                    size={60}
                                                    shape="circle"
                                                    icon={<HiOutlineUser />}
                                                    {...avatarProps}
                                                />
                                            </Upload>
                                        )
                                    }}
                                </Field>
                            </FormRow>
                            <FormRow
                                name="firstName"
                                label={t('text.labels.firstName')}
                                {...validatorProps}
                            >
                                <Field
                                    type="text"
                                    autoComplete="given-name"
                                    name="firstName"
                                    placeholder={t('text.labels.firstName')}
                                    component={Input}
                                    prefix={<HiOutlineUserCircle className="text-xl" />}
                                />
                            </FormRow>
                            <FormRow
                                name="lastName"
                                label={t('text.labels.lastName')}
                                {...validatorProps}
                            >
                                <Field
                                    type="text"
                                    autoComplete="family-name"
                                    name="lastName"
                                    placeholder={t('text.labels.lastName')}
                                    component={Input}
                                    prefix={<HiOutlineUser className="text-xl" />}
                                />
                            </FormRow>
                            <FormRow
                                name="email"
                                label={t('text.labels.email')}
                                {...validatorProps}
                            >
                                <Field
                                    type="email"
                                    autoComplete="email"
                                    name="email"
                                    placeholder={t('text.labels.email')}
                                    component={Input}
                                    prefix={<HiOutlineMail className="text-xl" />}
                                />
                            </FormRow>
                            <FormDesription
                                className="mt-8"
                                title={t('account.settings.profile.preferences')}
                                desc={t('account.settings.profile.preferencesDesc')}
                            />
                            <FormRow
                                name="lang"
                                label={t('text.labels.language')}
                                {...validatorProps}
                            >
                                <Field name="lang">
                                    {({ field, form }: FieldProps) => (
                                        <Select<LanguageOption>
                                            field={field}
                                            form={form}
                                            options={langOptions}
                                            components={{
                                                Option: CustomSelectOption,
                                                Control: CustomControl,
                                            }}
                                            value={langOptions.find(
                                                (option) =>
                                                    option.value === values.lang,
                                            )}
                                            onChange={(option) => {
                                                const selected = option?.value || normalizedLang
                                                form.setFieldValue(field.name, selected)
                                                dispatch(setLang(selected))
                                                i18n.changeLanguage(selected)
                                            }}
                                        />
                                    )}
                                </Field>
                            </FormRow>
                            <div className="mt-4 ltr:text-right">
                                <Button
                                    className="ltr:mr-2 rtl:ml-2"
                                    type="button"
                                    onClick={() => resetForm()}
                                >
                                    {t('text.actions.reset')}
                                </Button>
                                <Button
                                    variant="solid"
                                    loading={isSubmitting}
                                    type="submit"
                                >
                                    {isSubmitting
                                        ? t('text.actions.updating')
                                        : t('text.actions.update')}
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )
            }}
        </Formik>
    )
}

export default Profile
