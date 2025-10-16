import { useEffect, useRef } from 'react'
import Input from '@/components/ui/Input'
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
import { setLang, setUser, useAppDispatch, useAppSelector } from '@/store'
import type { OptionProps, ControlProps } from 'react-select'
import type { FieldProps, FormikHelpers, FormikProps } from 'formik'
import { apiUpdateAccountProfile } from '@/services/AccountServices'
import type { AxiosError } from 'axios'
import Avatar from '@/components/ui/Avatar'
import UserAvatar from '@/components/shared/UserAvatar'
import { resolveAvatarSrc } from '@/utils/avatar'

export type ProfileFormModel = {
    firstName: string
    lastName: string
    email: string
    avatar: string
    lang: string
    avatarFile: File | null
}

type ProfileInitialData = Partial<Omit<ProfileFormModel, 'avatarFile'>> & {
    name?: string
}

type ProfileProps = {
    data?: ProfileInitialData
}

type LanguageOption = {
    value: string
    label: string
    imgPath: string
}

type UpdateProfileResponse = {
    profile: {
        firstName: string
        lastName: string
        name: string
        email: string
        avatar: string
        lang: string
    }
    user?: {
        avatar?: string
        displayName?: string
        email?: string
        authority?: string[]
        name?: string
        lastName?: string
    }
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
    avatarFile: Yup.mixed<File>().nullable(),
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
    const authUser = useAppSelector((state) => state.auth.user)
    const avatarPreviewRef = useRef<string | null>(null)

    useEffect(() => {
        return () => {
            if (avatarPreviewRef.current) {
                URL.revokeObjectURL(avatarPreviewRef.current)
                avatarPreviewRef.current = null
            }
        }
    }, [])

    const fallbackNameSource =
        data.name ||
        [authUser?.name, authUser?.lastName].filter(Boolean).join(' ') ||
        ''
    const {
        firstName: fallbackFirstName,
        lastName: fallbackLastName,
    } = splitName(fallbackNameSource)

    const normalizedLang = (currentLang || i18n.language || 'en')
        .toLowerCase()
        .startsWith('es')
        ? 'es'
        : 'en'

    const initialAvatar =
        resolveAvatarSrc(data.avatar) ?? resolveAvatarSrc(authUser?.avatar) ?? ''

    const initialValues: ProfileFormModel = {
        firstName: data.firstName ?? fallbackFirstName ?? '',
        lastName:
            data.lastName ?? fallbackLastName ?? (authUser?.lastName ?? ''),
        email: data.email || authUser?.email || '',
        avatar: initialAvatar,
        lang: data.lang || normalizedLang,
        avatarFile: null,
    }

    const handleSetAvatar = (
        form: FormikProps<ProfileFormModel>,
        files: File[],
    ) => {
        if (avatarPreviewRef.current) {
            URL.revokeObjectURL(avatarPreviewRef.current)
            avatarPreviewRef.current = null
        }
        if (files.length) {
            const [file] = files
            const previewUrl = URL.createObjectURL(file)
            avatarPreviewRef.current = previewUrl
            form.setFieldValue('avatar', previewUrl)
            form.setFieldValue('avatarFile', file)
            form.setFieldTouched('avatarFile', true, false)
        } else {
            form.setFieldValue('avatar', form.initialValues.avatar || '')
            form.setFieldValue('avatarFile', null)
            form.setFieldTouched('avatarFile', false, false)
        }
    }

    const handleSubmit = async (
        values: ProfileFormModel,
        helpers: FormikHelpers<ProfileFormModel>,
    ) => {
        const { setSubmitting, resetForm } = helpers
        setSubmitting(true)
        const trimmedFirstName = values.firstName.trim()
        const trimmedLastName = values.lastName.trim()
        const trimmedEmail = values.email.trim()

        const formData = new FormData()
        formData.append('firstName', trimmedFirstName)
        if (trimmedLastName) {
            formData.append('lastName', trimmedLastName)
        }
        formData.append('email', trimmedEmail)
        formData.append('lang', values.lang)
        if (values.avatarFile) {
            formData.append('avatar', values.avatarFile)
        }

        try {
            const response = await apiUpdateAccountProfile<
                UpdateProfileResponse,
                FormData
            >(formData)
            const updatedProfile = response.data?.profile
            const nextLang = updatedProfile?.lang || values.lang
            dispatch(setLang(nextLang))
            i18n.changeLanguage(nextLang)
            if (response.data?.user) {
                const userResponse = response.data.user
                const computedDisplayName =
                    userResponse.displayName ??
                    ([userResponse.name, userResponse.lastName]
                        .filter(Boolean)
                        .join(' ') ||
                        userResponse.name ||
                        userResponse.email ||
                        '')
                dispatch(
                    setUser({
                        ...userResponse,
                        displayName: computedDisplayName,
                    }),
                )
            }
            const resolvedValues: ProfileFormModel = {
                firstName: updatedProfile?.firstName || trimmedFirstName,
                lastName: updatedProfile?.lastName || trimmedLastName,
                email: updatedProfile?.email || trimmedEmail,
                avatar:
                    updatedProfile?.avatar ||
                    (values.avatarFile ? '' : values.avatar),
                lang: nextLang,
                avatarFile: null,
            }
            if (avatarPreviewRef.current) {
                URL.revokeObjectURL(avatarPreviewRef.current)
                avatarPreviewRef.current = null
            }
            resetForm({ values: resolvedValues })
            toast.push(
                <Notification
                    title={t('account.settings.profile.profileUpdated')}
                    type="success"
                />,
                { placement: 'top-center' },
            )
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>
            const fallbackMessage = t(
                'account.settings.profile.updateFailed',
                {
                    defaultValue: 'We could not update your profile.',
                },
            )
            const message = err.response?.data?.message
                ? t(err.response.data.message, { defaultValue: fallbackMessage })
                : fallbackMessage
            toast.push(
                <Notification title={message} type="danger" />,
                { placement: 'top-center' },
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Formik
            enableReinitialize
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
        >
            {({ values, touched, errors, isSubmitting, resetForm }) => {
                const validatorProps = { touched, errors }
                const handleReset = () => {
                    if (avatarPreviewRef.current) {
                        URL.revokeObjectURL(avatarPreviewRef.current)
                        avatarPreviewRef.current = null
                    }
                    resetForm()
                }
                return (
                    <Form>
                        <FormContainer>
                            <FormDesription
                                title={t('account.settings.profile.general')}
                                desc={t('account.settings.profile.generalDesc')}
                            />
                            <FormRow
                                name="avatar"
                                label={t('text.labels.avatar', {
                                    defaultValue: 'Avatar',
                                })}
                                {...validatorProps}
                            >
                                <Field name="avatar">
                                    {({ field, form }: FieldProps<string>) => {
                                        return (
                                            <Upload
                                                className="cursor-pointer"
                                                showList={false}
                                                uploadLimit={1}
                                                onChange={(files) =>
                                                    handleSetAvatar(form, files)
                                                }
                                                onFileRemove={(files) =>
                                                    handleSetAvatar(form, files)
                                                }
                                            >
                                                <UserAvatar
                                                    className="border-2 border-white dark:border-gray-800 shadow-lg"
                                                    size={60}
                                                    shape="circle"
                                                    src={field.value}
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
                                    onClick={handleReset}
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
