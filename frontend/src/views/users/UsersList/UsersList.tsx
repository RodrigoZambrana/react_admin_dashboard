import { useEffect, useRef, useState } from 'react'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { HiOutlineUser, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi'
import Input from '@/components/ui/Input'
import {
    apiCreateUser,
    apiGetUsers,
    apiUpdateUser,
    apiUpdateUserPassword,
    apiDeleteUser,
} from '@/services/UsersService'
import Select from '@/components/ui/Select'
import { useTranslation } from 'react-i18next'
import Drawer from '@/components/ui/Drawer'
import { Formik, Form, Field, type FormikHelpers } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import * as Yup from 'yup'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useLocation, useNavigate } from 'react-router-dom'
import CountryCitySelector from '@/components/shared/CountryCitySelector'
import Upload from '@/components/ui/Upload'
import type { AxiosError } from 'axios'
import Tabs from '@/components/ui/Tabs'
import PasswordInput from '@/components/shared/PasswordInput'
import { ROLE_OPTIONS, USER, type Role } from '@/constants/roles.constant'
import { PASSWORD_COMPLEXITY_REGEX } from '@/constants/security.constant'
import {
    sanitizePayload,
    isSuspiciousString,
    UnsafeInputError,
} from '@/utils/security/inputGuards'

type User = {
    id: string | number
    name: string
    lastName?: string
    email: string
    img?: string
    role?: Role
    country?: string
    countryCode?: string
    city?: string
}

type UserFormValues = {
    id?: string | number
    name: string
    lastName?: string
    email: string
    img?: string
    avatarFile: File | null
    avatarPreview: string
    role: Role
    country: string
    countryCode: string
    city: string
}

type PasswordFormValues = {
    password: string
    confirmPassword: string
}

const DEFAULT_USER_FORM: UserFormValues = {
    name: '',
    lastName: '',
    email: '',
    img: '',
    avatarFile: null,
    avatarPreview: '',
    role: USER,
    country: 'Uruguay',
    countryCode: 'UY',
    city: 'Montevideo',
}

const PASSWORD_FORM: PasswordFormValues = {
    password: '',
    confirmPassword: '',
}

const normalizeRole = (role?: string | Role): Role =>
    role ? (String(role).toUpperCase() as Role) : USER

const UsersList = () => {
    const [users, setUsers] = useState<User[]>([])
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editing, setEditing] = useState<UserFormValues | null>(null)
    const [activeTab, setActiveTab] = useState<'details' | 'password'>('details')
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
    const avatarPreviewRef = useRef<string | null>(null)
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()

    const revokePreview = () => {
        if (avatarPreviewRef.current) {
            URL.revokeObjectURL(avatarPreviewRef.current)
            avatarPreviewRef.current = null
        }
    }

    useEffect(() => {
        const fetch = async () => {
            const resp = await apiGetUsers<User[]>()
            const fetched = resp.data || []
            setUsers(
                fetched.map((user) => ({
                    ...user,
                    role: normalizeRole(user.role),
                })),
            )
        }
        fetch()
    }, [])

    const filtered = users.filter((u) => {
        const search = query.toLowerCase()
        const fullName = `${u.name ?? ''} ${u.lastName ?? ''}`.trim()
        return (
            fullName.toLowerCase().includes(search) ||
            (u.email ?? '').toLowerCase().includes(search)
        )
    })

    const safeStringValidator = (value?: string | null) =>
        !value || !isSuspiciousString(value)

    const schema = Yup.object().shape({
        name: Yup.string()
            .required('text.validation.userNameRequired')
            .test('safe-name', 'text.validation.invalidCharacters', safeStringValidator),
        lastName: Yup.string()
            .nullable()
            .test('safe-lastname', 'text.validation.invalidCharacters', safeStringValidator),
        email: Yup.string()
            .email('text.validation.invalidEmail')
            .required('text.validation.emailRequired'),
        avatarFile: Yup.mixed<File>().nullable(),
        country: Yup.string()
            .nullable()
            .test('safe-country', 'text.validation.invalidCharacters', safeStringValidator),
        city: Yup.string()
            .nullable()
            .test('safe-city', 'text.validation.invalidCharacters', safeStringValidator),
        countryCode: Yup.string()
            .nullable()
            .test('safe-countryCode', 'text.validation.invalidCharacters', safeStringValidator),
    })

    const passwordSchema = Yup.object().shape({
        password: Yup.string()
            .required('text.validation.passwordRequired')
            .matches(PASSWORD_COMPLEXITY_REGEX, 'text.validation.passwordComplexity'),
        confirmPassword: Yup.string()
            .required('text.validation.confirmPasswordRequired')
            .oneOf([Yup.ref('password')], 'text.validation.passwordMismatch'),
    })

    const onEdit = (user: User) => {
        revokePreview()
        setEditing({
            id: user.id,
            name: user.name,
            lastName: user.lastName || '',
            email: user.email,
            img: user.img,
            avatarFile: null,
            avatarPreview: user.img || '',
            role: normalizeRole(user.role),
            country: user.country?.trim() || DEFAULT_USER_FORM.country,
            countryCode: user.countryCode?.trim() || DEFAULT_USER_FORM.countryCode,
            city: user.city?.trim() || DEFAULT_USER_FORM.city,
        })
        setDrawerOpen(true)
        setActiveTab('details')
    }

    const handleDrawerClose = () => {
        revokePreview()
        setDrawerOpen(false)
        setEditing(null)
        setActiveTab('details')
    }

    const handleDeleteUser = async (user: User) => {
        const confirmMessage = t('text.messages.deleteUserConfirm', {
            defaultValue:
                'Are you sure you want to delete this user? This action cannot be undone.',
        })
        const confirmed =
            typeof window !== 'undefined' ? window.confirm(confirmMessage) : true
        if (!confirmed) {
            return
        }
        try {
            setDeletingUserId(String(user.id))
            await apiDeleteUser<{ success: boolean }>(String(user.id))
            setUsers((prev) =>
                prev.filter((existing) => String(existing.id) !== String(user.id)),
            )
            if (editing?.id && String(editing.id) === String(user.id)) {
                handleDrawerClose()
            }
            toast.push(
                <Notification
                    title={t('text.messages.userDeleted', {
                        defaultValue: 'User deleted',
                    })}
                    type="success"
                />,
                { placement: 'top-center' },
            )
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>
            const fallbackMessage = t('text.messages.userDeleteFailed', {
                defaultValue: 'We could not delete the user.',
            })
            const message = err.response?.data?.message
                ? t(err.response.data.message, { defaultValue: fallbackMessage })
                : fallbackMessage
            toast.push(
                <Notification title={message} type="danger" />,
                { placement: 'top-center' },
            )
        } finally {
            setDeletingUserId(null)
        }
    }

    const onCreate = () => {
        revokePreview()
        setEditing({ ...DEFAULT_USER_FORM })
        setDrawerOpen(true)
        setActiveTab('details')
    }

    useEffect(() => {
        const state = (location.state || {}) as { openUserDrawer?: 'new' }
        if (state.openUserDrawer === 'new') {
            revokePreview()
            setEditing({ ...DEFAULT_USER_FORM })
            setDrawerOpen(true)
            setActiveTab('details')
            navigate(location.pathname, { replace: true })
        }
    }, [location, navigate])

    const notifyUnsafeInput = () => {
        toast.push(
            <Notification
                title={t('text.validation.invalidCharacters', {
                    defaultValue: 'Detected forbidden characters in the form.',
                })}
                type="danger"
            />,
            { placement: 'top-center' },
        )
    }

    const onSubmit = async (values: UserFormValues) => {
        let sanitizedFields: {
            name: string
            lastName: string
            email: string
            role: Role
            country: string
            countryCode: string
            city: string
        }

        try {
            sanitizedFields = sanitizePayload({
                name: values.name.trim(),
                lastName: values.lastName?.trim() || '',
                email: values.email.trim(),
                role: normalizeRole(values.role),
                country: values.country?.trim() || '',
                countryCode: values.countryCode?.trim().toUpperCase() || '',
                city: values.city?.trim() || '',
            }) as typeof sanitizedFields
        } catch (error) {
            if (error instanceof UnsafeInputError) {
                notifyUnsafeInput()
                return
            }
            throw error
        }

        const { name, lastName, email, role, country, city, countryCode } =
            sanitizedFields

        const formData = new FormData()
        formData.append('name', name)
        if (lastName) {
            formData.append('lastName', lastName)
        }
        formData.append('email', email)
        formData.append('role', role)
        formData.append('country', country)
        formData.append('countryCode', countryCode)
        formData.append('city', city)
        if (values.avatarFile) {
            formData.append('avatar', values.avatarFile)
        }

        const fallbackUser: User = {
            id: values.id ?? Date.now(),
            name,
            lastName,
            email,
            img: values.img || '',
            role,
            country,
            countryCode,
            city,
        }

        try {
            if (values.id) {
                const resp = await apiUpdateUser<User, FormData>(
                    String(values.id),
                    formData,
                )
                const updated = resp.data || fallbackUser
                const normalizedUpdated: User = {
                    ...updated,
                    role: normalizeRole(updated.role),
                    country,
                    countryCode,
                    city,
                }
                setUsers((prev) =>
                    prev.map((u) =>
                        String(u.id) === String(normalizedUpdated.id)
                            ? { ...u, ...normalizedUpdated }
                            : u,
                    ),
                )
                toast.push(
                    <Notification title={t('text.messages.userUpdated')} type="success" />,
                    { placement: 'top-center' },
                )
            } else {
                const resp = await apiCreateUser<User, FormData>(formData)
                const created = resp.data || fallbackUser
                const normalizedCreated: User = {
                    ...created,
                    role: normalizeRole(created.role),
                    country,
                    countryCode,
                    city,
                }
                setUsers((prev) => [normalizedCreated, ...prev])
                toast.push(
                    <Notification title={t('text.messages.userCreated')} type="success" />,
                    { placement: 'top-center' },
                )
            }
            handleDrawerClose()
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>
            const fallbackMessage = t('text.messages.userSaveFailed', {
                defaultValue: 'We could not save the user.',
            })
            const message = err.response?.data?.message
                ? t(err.response.data.message, { defaultValue: fallbackMessage })
                : fallbackMessage
            toast.push(
                <Notification title={message} type="danger" />,
                { placement: 'top-center' },
            )
        }
    }

    const onPasswordSubmit = async (
        values: PasswordFormValues,
        helpers: FormikHelpers<PasswordFormValues>,
    ) => {
        if (!editing?.id) {
            helpers.setSubmitting(false)
            return
        }

        const password = values.password.trim()
        const confirm = values.confirmPassword.trim()

        if (!password || !confirm || password !== confirm) {
            helpers.setSubmitting(false)
            return
        }

        if (isSuspiciousString(password) || isSuspiciousString(confirm)) {
            notifyUnsafeInput()
            helpers.setSubmitting(false)
            return
        }

        try {
            await apiUpdateUserPassword<{ success: boolean }>(String(editing.id), {
                password,
            })
            toast.push(
                <Notification title={t('text.messages.passwordUpdated')} type="success" />,
                { placement: 'top-center' },
            )
            helpers.resetForm()
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>
            const fallbackMessage = t('text.messages.passwordUpdateFailed', {
                defaultValue: 'We could not update the password.',
            })
            const message = err.response?.data?.message
                ? t(err.response.data.message, { defaultValue: fallbackMessage })
                : fallbackMessage
            toast.push(
                <Notification title={message} type="danger" />,
                { placement: 'top-center' },
            )
        } finally {
            helpers.setSubmitting(false)
        }
    }

    return (
        <Container>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3>{t('nav.appsUsers.userList')}</h3>
                <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto md:justify-end">
                    <Input
                        size="sm"
                        className="w-full sm:w-64"
                        placeholder={t('text.placeholders.search')}
                        prefix={<HiOutlineSearch className="text-lg" />}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <Button
                        size="sm"
                        variant="solid"
                        onClick={onCreate}
                        className="w-full sm:w-auto"
                    >
                        {t('nav.appsUsers.userNew')}
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((user) => (
                    <Card
                        key={user.id}
                        onClick={() => onEdit(user)}
                        className="cursor-pointer"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    src={user.img || undefined}
                                    shape="circle"
                                    icon={<HiOutlineUser />}
                                />
                                <div>
                                    <div className="font-semibold">
                                        {(
                                            [user.name, user.lastName]
                                                .filter(Boolean)
                                                .join(' ') || user.email || ''
                                        ).trim()}
                                    </div>
                                    <div className="text-sm opacity-70">{user.email}</div>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineTrash />}
                                loading={deletingUserId === String(user.id)}
                                disabled={
                                    Boolean(
                                        deletingUserId &&
                                            deletingUserId !== String(user.id),
                                    )
                                }
                                onClick={(event) => {
                                    event.stopPropagation()
                                    handleDeleteUser(user)
                                }}
                                aria-label={t('text.actions.delete', {
                                    defaultValue: 'Delete',
                                })}
                            />
                        </div>
                    </Card>
                ))}
            </div>
            <Drawer
                isOpen={drawerOpen}
                width={420}
                placement="right"
                onClose={handleDrawerClose}
                onRequestClose={handleDrawerClose}
                title={editing?.id ? t('text.actions.edit') : t('nav.appsUsers.userNew')}
            >
                {editing && (
                    <Tabs
                        value={activeTab}
                        onChange={(val) =>
                            setActiveTab((val as 'details' | 'password') ?? 'details')
                        }
                    >
                        <Tabs.TabList className="mb-4">
                            <Tabs.TabNav value="details">
                                {t('text.tabs.userDetails', {
                                    defaultValue: 'Details',
                                })}
                            </Tabs.TabNav>
                            <Tabs.TabNav value="password" disabled={!editing.id}>
                                {t('text.tabs.password', {
                                    defaultValue: 'Password',
                                })}
                            </Tabs.TabNav>
                        </Tabs.TabList>
                        <Tabs.TabContent value="details">
                            <Formik
                                initialValues={editing}
                                validationSchema={schema}
                                onSubmit={onSubmit}
                                enableReinitialize
                            >
                                {({ errors, touched, values, setFieldValue, setFieldTouched }) => {
                                    const handleAvatarChange = (files: File[]) => {
                                        if (avatarPreviewRef.current) {
                                            URL.revokeObjectURL(avatarPreviewRef.current)
                                            avatarPreviewRef.current = null
                                        }
                                        if (files.length) {
                                            const [file] = files
                                            const previewUrl = URL.createObjectURL(file)
                                            avatarPreviewRef.current = previewUrl
                                            setFieldValue('avatarPreview', previewUrl)
                                            setFieldValue('avatarFile', file)
                                            setFieldTouched('avatarFile', true, false)
                                        } else {
                                            setFieldValue('avatarPreview', '')
                                            setFieldValue('avatarFile', null)
                                            setFieldTouched('avatarFile', false, false)
                                        }
                                    }

                                    return (
                                        <Form>
                                            <FormContainer>
                                                <FormItem
                                                    label={t('text.labels.avatar', {
                                                        defaultValue: 'Avatar',
                                                    })}
                                                    invalid={
                                                        !!errors.avatarFile &&
                                                        !!touched.avatarFile
                                                    }
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Upload
                                                            className="cursor-pointer"
                                                            showList={false}
                                                            uploadLimit={1}
                                                            onChange={(files) =>
                                                                handleAvatarChange(
                                                                    files as File[],
                                                                )
                                                            }
                                                            onFileRemove={(files) =>
                                                                handleAvatarChange(
                                                                    files as File[],
                                                                )
                                                            }
                                                        >
                                                            <Avatar
                                                                src={
                                                                    values.avatarPreview ||
                                                                    values.img ||
                                                                    undefined
                                                                }
                                                                shape="circle"
                                                                size={56}
                                                                icon={<HiOutlineUser />}
                                                            />
                                                        </Upload>
                                                        {values.avatarFile && (
                                                            <Button
                                                                size="xs"
                                                                type="button"
                                                                onClick={() =>
                                                                    handleAvatarChange(
                                                                        [],
                                                                    )
                                                                }
                                                            >
                                                                {t('text.actions.remove')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </FormItem>
                                                <FormItem
                                                    label={t('text.labels.name')}
                                                    invalid={!!errors.name && !!touched.name}
                                                    errorMessage={t(errors.name as string)}
                                                >
                                                    <Field
                                                        name="name"
                                                        component={Input}
                                                        placeholder={t('text.labels.name')}
                                                    />
                                                </FormItem>
                                                <FormItem label={t('text.labels.lastName')}>
                                                    <Field
                                                        name="lastName"
                                                        component={Input}
                                                        placeholder={t('text.labels.lastName')}
                                                    />
                                                </FormItem>
                                                <FormItem
                                                    label={t('text.labels.email')}
                                                    invalid={!!errors.email && !!touched.email}
                                                    errorMessage={t(errors.email as string)}
                                                >
                                                    <Field
                                                        name="email"
                                                        component={Input}
                                                        placeholder={t('text.labels.email')}
                                                    />
                                                </FormItem>
                                                <FormItem
                                                    label={`${t('text.labels.country')} / ${t('text.labels.city')}`}
                                                >
                                                    <CountryCitySelector
                                                        value={{
                                                            countryCode: values.countryCode,
                                                            countryName: values.country,
                                                            city: values.city,
                                                        }}
                                                        onChange={(next) => {
                                                            setFieldValue('country', next.countryName ?? '')
                                                            setFieldValue('countryCode', next.countryCode ?? '')
                                                            setFieldValue('city', next.city ?? '')
                                                            setFieldTouched('country', true, false)
                                                            if (next.city !== undefined) {
                                                                setFieldTouched('city', true, false)
                                                            }
                                                        }}
                                                        countryPlaceholder={t('text.labels.country')}
                                                        cityPlaceholder={t('text.labels.city')}
                                                    />
                                                </FormItem>
                                                <FormItem label={t('text.labels.role')}>
                                                    <Select
                                                        options={ROLE_OPTIONS}
                                                        value={
                                                            ROLE_OPTIONS.find(
                                                                (option) =>
                                                                    option.value ===
                                                                    normalizeRole(values.role),
                                                            ) ?? ROLE_OPTIONS[0]
                                                        }
                                                        onChange={(opt) =>
                                                            setFieldValue(
                                                                'role',
                                                                normalizeRole(
                                                                    (opt as { value?: string } | null)?.value,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </FormItem>
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" onClick={handleDrawerClose}>
                                                        {t('text.actions.cancel')}
                                                    </Button>
                                                    <Button variant="solid" type="submit">
                                                        {values.id
                                                            ? t('text.actions.update')
                                                            : t('text.actions.save')}
                                                    </Button>
                                                </div>
                                            </FormContainer>
                                        </Form>
                                    )
                                }}
                            </Formik>
                        </Tabs.TabContent>
                        <Tabs.TabContent value="password">
                            {editing.id ? (
                                <Formik
                                    initialValues={PASSWORD_FORM}
                                    validationSchema={passwordSchema}
                                    onSubmit={onPasswordSubmit}
                                >
                                    {({ errors, touched, isSubmitting }) => (
                                        <Form>
                                            <FormContainer>
                                                <FormItem
                                                    label={t('text.labels.password')}
                                                    invalid={!!errors.password && !!touched.password}
                                                    errorMessage={t(errors.password as string)}
                                                >
                                                    <Field
                                                        name="password"
                                                        component={PasswordInput}
                                                        placeholder={t('text.placeholders.newPassword')}
                                                        autoComplete="new-password"
                                                    />
                                                </FormItem>
                                                <FormItem
                                                    label={t('text.labels.confirmPassword', {
                                                        defaultValue: 'Confirm Password',
                                                    })}
                                                    invalid={
                                                        !!errors.confirmPassword &&
                                                        !!touched.confirmPassword
                                                    }
                                                    errorMessage={t(errors.confirmPassword as string)}
                                                >
                                                    <Field
                                                        name="confirmPassword"
                                                        component={PasswordInput}
                                                        placeholder={t('text.placeholders.confirmPassword')}
                                                        autoComplete="new-password"
                                                    />
                                                </FormItem>
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" onClick={handleDrawerClose}>
                                                        {t('text.actions.cancel')}
                                                    </Button>
                                                    <Button
                                                        variant="solid"
                                                        type="submit"
                                                        loading={isSubmitting}
                                                    >
                                                        {t('text.actions.updatePassword')}
                                                    </Button>
                                                </div>
                                            </FormContainer>
                                        </Form>
                                    )}
                                </Formik>
                            ) : (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('text.messages.passwordTabRequiresUser', {
                                        defaultValue: 'Create the user before setting a password.',
                                    })}
                                </div>
                            )}
                        </Tabs.TabContent>
                    </Tabs>
                )}
            </Drawer>
        </Container>
    )
}

export default UsersList
