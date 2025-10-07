import { useEffect, useState } from 'react'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { HiOutlineUser } from 'react-icons/hi'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import { apiCreateUser, apiGetUsers, apiUpdateUser } from '@/services/UsersService'
import Select from '@/components/ui/Select'
import { useTranslation } from 'react-i18next'
import Drawer from '@/components/ui/Drawer'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import * as Yup from 'yup'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useLocation, useNavigate } from 'react-router-dom'
import CountryCitySelector from '@/components/shared/CountryCitySelector'

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
    role: string
    country: string
    countryCode: string
    city: string
}

const DEFAULT_USER_FORM: UserFormValues = {
    name: '',
    lastName: '',
    email: '',
    img: '',
    role: 'user',
    country: '',
    countryCode: '',
    city: '',
}

const UsersList = () => {
    const [users, setUsers] = useState<User[]>([])
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editing, setEditing] = useState<UserFormValues | null>(null)
    const { t } = useTranslation()
    const location = useLocation()
    const navigate = useNavigate()

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
        img: Yup.string().url().nullable(),
        country: Yup.string().nullable(),
        city: Yup.string().nullable(),
        countryCode: Yup.string().nullable(),
    })

    const onEdit = (user: User) => {
        setEditing({
            id: user.id,
            name: user.name,
            lastName: user.lastName || '',
            email: user.email,
            img: user.img,
            role: (user.role || 'user').toLowerCase(),
            country: user.country || '',
            countryCode: user.countryCode || '',
            city: user.city || '',
        })
        setDrawerOpen(true)
    }

    const handleDrawerClose = () => {
        setDrawerOpen(false)
        setEditing(null)
    }

    const onCreate = () => {
        setEditing({ ...DEFAULT_USER_FORM })
        setDrawerOpen(true)
    }

    useEffect(() => {
        const state = (location.state || {}) as { openUserDrawer?: 'new' }
        if (state.openUserDrawer === 'new') {
            setEditing({ ...DEFAULT_USER_FORM })
            setDrawerOpen(true)
            navigate(location.pathname, { replace: true })
        }
    }, [location, navigate])

    const onSubmit = async (values: UserFormValues) => {
        const name = values.name.trim()
        const lastName = values.lastName?.trim() || ''
        const email = values.email.trim()
        const img = values.img?.trim() || ''
        const countryName = values.country?.trim() || ''
        const cityName = values.city?.trim() || ''
        const countryCode = values.countryCode?.trim() || ''
        const payload = {
            name,
            lastName: lastName ? lastName : undefined,
            email,
            img: img || undefined,
            role: values.role,
            country: countryName || undefined,
            countryCode: countryCode || undefined,
            city: cityName || undefined,
        }

        if (values.id) {
            const resp = await apiUpdateUser<User, typeof payload>(
                String(values.id),
                payload,
            )
            const updated =
                resp.data ||
                ({
                    id: values.id,
                    name,
                    lastName,
                    email,
                    img,
                    role: values.role,
                } as User)
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
            const resp = await apiCreateUser<User, typeof payload>(payload)
            const created =
                resp.data ||
                ({
                    id: Date.now(),
                    name,
                    lastName,
                    email,
                    img,
                    role: values.role,
                } as User)
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
                    <Formik initialValues={editing} validationSchema={schema} onSubmit={onSubmit} enableReinitialize>
                        {({ errors, touched, values, setFieldValue, setFieldTouched }) => (
                            <Form>
                                <FormContainer>
                                    <FormItem label={t('text.labels.name')} invalid={!!errors.name && !!touched.name} errorMessage={t(errors.name as string)}>
                                        <Field name="name" component={Input} placeholder={t('text.labels.name')} />
                                    </FormItem>
                                    <FormItem label={t('text.labels.lastName')}>
                                        <Field name="lastName" component={Input} placeholder={t('text.labels.lastName')} />
                                    </FormItem>
                                    <FormItem label={t('text.labels.email')} invalid={!!errors.email && !!touched.email} errorMessage={t(errors.email as string)}>
                                        <Field name="email" component={Input} placeholder={t('text.labels.email')} />
                                    </FormItem>
                                    <FormItem label="Avatar URL" invalid={!!errors.img && !!touched.img} errorMessage={errors.img as string}>
                                        <Field name="img" component={Input} placeholder="https://..." />
                                    </FormItem>
                                    <FormItem label={`${t('text.labels.country')} / ${t('text.labels.city')}`}>
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
                                            onChange={(opt) => setFieldValue('role', (opt as any).value)}
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
                        )}
                    </Formik>
                )}
            </Drawer>
        </Container>
    )
}

export default UsersList
