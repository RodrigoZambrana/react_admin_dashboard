import { useEffect, useRef, useState } from 'react'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { HiOutlineUser } from 'react-icons/hi'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import {
    apiCreateUser,
    apiGetUsers,
    apiUpdateUser,
    apiUpdateUserPassword,
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

type User = {
    id: string | number
    name: string
    lastName?: string
    email: string
    img?: string
    role?: string
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
    role: string
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
    role: 'user',
    country: 'Uruguay',
    countryCode: 'UY',
    city: 'Montevideo',
}

const PASSWORD_FORM: PasswordFormValues = {
    password: '',
    confirmPassword: '',
}

const UsersList = () => {
    const [users, setUsers] = useState<User[]>([])
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editing, setEditing] = useState<UserFormValues | null>(null)
    const [activeTab, setActiveTab] = useState<'details' | 'password'>('details')
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
            setUsers(resp.data || [])
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

    const schema = Yup.object().shape({
        name: Yup.string().required('text.validation.userNameRequired'),
        lastName: Yup.string().nullable(),
        email: Yup.string().email('text.validation.invalidEmail').required('text.validation.emailRequired'),
        avatarFile: Yup.mixed<File>().nullable(),
        country: Yup.string().nullable(),
        city: Yup.string().nullable(),
        countryCode: Yup.string().nullable(),
    })

    const passwordSchema = Yup.object().shape({
        password: Yup.string().required('text.validation.passwordRequired'),
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
            role: (user.role || 'user').toLowerCase(),
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

    const onSubmit = async (values: UserFormValues) => {
        const name = values.name.trim()
        const lastName = values.lastName?.trim() || ''
        const email = values.email.trim()
        const role = (values.role || 'user').toLowerCase()
        const countryName = values.country?.trim() || ''
        const cityName = values.city?.trim() || ''
        const countryCode = values.countryCode?.trim().toUpperCase() || ''

        const formData = new FormData()
        formData.append('name', name)
        if (lastName) {
            formData.append('lastName', lastName)
        }
        formData.append('email', email)
        formData.append('role', role)
        formData.append('country', countryName)
        formData.append('countryCode', countryCode)
        formData.append('city', cityName)
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
            country: countryName,
            countryCode,
            city: cityName,
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
                    country: countryName,
                    countryCode,
                    city: cityName,
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
                    country: countryName,
                    countryCode,
                    city: cityName,
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
            <div className="flex items-center justify-between mb-4 gap-2">
                <h3>{t('nav.appsUsers.userList')}</h3>
                <div className="flex items-center gap-2">
                    <div className="w-64">
                        <Input
                            size="sm"
                            placeholder={t('text.placeholders.search')}
                            prefix={<HiOutlineSearch className="text-lg" />}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <Button size="sm" variant="solid" onClick={onCreate}>
                        {t('nav.appsUsers.userNew')}
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((user) => (
                    <Card key={user.id} onClick={() => onEdit(user)} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Avatar src={user.img || undefined} shape="circle" icon={<HiOutlineUser />} />
                            <div>
                                <div className="font-semibold">
                                    {([user.name, user.lastName].filter(Boolean).join(' ') || user.email || '').trim()}
                                </div>
                                <div className="text-sm opacity-70">{user.email}</div>
                            </div>
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
                                                        options={[
                                                            { value: 'superadmin', label: 'Superadmin' },
                                                            { value: 'admin', label: 'Admin' },
                                                            { value: 'user', label: 'User' },
                                                        ]}
                                                        value={{
                                                            value: (values.role || 'user').toLowerCase(),
                                                            label:
                                                                values.role === 'superadmin'
                                                                    ? 'Superadmin'
                                                                    : (values.role || 'user')
                                                                          .charAt(0)
                                                                          .toUpperCase() + (values.role || 'user').slice(1),
                                                        }}
                                                        onChange={(opt) =>
                                                            setFieldValue('role', (opt as any).value)
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
