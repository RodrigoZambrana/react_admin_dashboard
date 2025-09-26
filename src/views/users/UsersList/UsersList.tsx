import { useEffect, useState } from 'react'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import { apiGetUsers, apiUpdateUser } from '@/services/UsersService'
import { useTranslation } from 'react-i18next'
import Drawer from '@/components/ui/Drawer'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import * as Yup from 'yup'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { Link } from 'react-router-dom'

type User = {
    id: string
    name: string
    email: string
    img?: string
}

const UsersList = () => {
    const [users, setUsers] = useState<User[]>([])
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editing, setEditing] = useState<User | null>(null)
    const { t } = useTranslation()

    useEffect(() => {
        const fetch = async () => {
            const resp = await apiGetUsers<User[]>()
            setUsers(resp.data || [])
        }
        fetch()
    }, [])

    const filtered = users.filter(
        (u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase()),
    )

    const schema = Yup.object().shape({
        name: Yup.string().required('text.validation.userNameRequired'),
        email: Yup.string().email('text.validation.invalidEmail').required('text.validation.emailRequired'),
        img: Yup.string().url().nullable(),
    })

    const onEdit = (user: User) => {
        setEditing(user)
        setDrawerOpen(true)
    }

    const onSubmit = async (values: User) => {
        const resp = await apiUpdateUser<User, Partial<User>>(values.id, values)
        const updated = resp.data || values
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
        toast.push(<Notification title={t('text.messages.userCreated')} type="success" />, { placement: 'top-center' })
        setDrawerOpen(false)
        setEditing(null)
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
                    <Link to="/app/users/new">
                        <Button size="sm" variant="solid">
                            {t('nav.appsUsers.userNew')}
                        </Button>
                    </Link>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((user) => (
                    <Card key={user.id} onClick={() => onEdit(user)} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                            <Avatar src={user.img} shape="circle" />
                            <div>
                                <div className="font-semibold">{user.name}</div>
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
                onClose={() => setDrawerOpen(false)}
                onRequestClose={() => setDrawerOpen(false)}
                title={t('text.actions.edit')}
            >
                {editing && (
                    <Formik initialValues={editing} validationSchema={schema} onSubmit={onSubmit}>
                        {({ errors, touched }) => (
                            <Form>
                                <FormContainer>
                                    <FormItem label={t('text.labels.name')} invalid={!!errors.name && !!touched.name} errorMessage={t(errors.name as string)}>
                                        <Field name="name" component={Input} placeholder={t('text.labels.name')} />
                                    </FormItem>
                                    <FormItem label={t('text.labels.email')} invalid={!!errors.email && !!touched.email} errorMessage={t(errors.email as string)}>
                                        <Field name="email" component={Input} placeholder={t('text.labels.email')} />
                                    </FormItem>
                                    <FormItem label="Avatar URL" invalid={!!errors.img && !!touched.img} errorMessage={errors.img as string}>
                                        <Field name="img" component={Input} placeholder="https://..." />
                                    </FormItem>
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" onClick={() => setDrawerOpen(false)}>
                                            {t('text.actions.cancel')}
                                        </Button>
                                        <Button variant="solid" type="submit">
                                            {t('text.actions.update')}
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
