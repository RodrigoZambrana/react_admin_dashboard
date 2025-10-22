import { forwardRef, useState, useImperativeHandle, useRef } from 'react'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { Field, Form, Formik, FormikProps, FieldProps } from 'formik'
import RichTextEditor from '@/components/shared/RichTextEditor'
import {
    updateReply,
    toggleNewMessageDialog,
    useAppDispatch,
    useAppSelector,
    sendInboxMessage,
    Mail,
} from '../store'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import type { RichTextEditorRef } from '@/components/shared/RichTextEditor'

const stripHtml = (content: string) =>
    content
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')

const extractPlainText = (content?: string | null) => {
    if (!content) {
        return ''
    }
    return stripHtml(content).replace(/\s+/g, ' ').trim()
}

const isRichTextEmpty = (content?: string | null) =>
    extractPlainText(content).length === 0

const validationSchema = Yup.object().shape({
    title: Yup.string().required('text.validation.titleRequired'),
    to: Yup.string().required('text.validation.receiverRequired'),
    cc: Yup.string(),
    bcc: Yup.string(),
    message: Yup.string().test(
        'messageBodyRequired',
        'text.validation.messageBodyRequired',
        (value) => !isRichTextEmpty(value),
    ),
})

type FormModel = {
    title: string
    to: string
    cc: string
    bcc: string
    message: string
}

type MailEditorProps = {
    mail?: Partial<Mail>
    mode?: 'reply' | 'new'
}

export type FormikRef = FormikProps<FormModel>

export type MailEditorRef = {
    formikRef: FormikRef | null
    editorRef: RichTextEditorRef | null
}

const MailEditor = forwardRef<MailEditorRef, MailEditorProps>((props, ref) => {
    const { mode = 'new', mail = {} } = props
    const { t } = useTranslation()

    const formikRef = useRef<FormikRef>(null)
    const editorRef = useRef<RichTextEditorRef>(null)

    // Expose formikRef and editorRef on the ref object
    useImperativeHandle(ref, () => ({
        formikRef: formikRef.current,
        editorRef: editorRef.current,
    }))

    const dispatch = useAppDispatch()

    const [showCC, setShowCC] = useState(false)
    const [showBcc, setShowBcc] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const inboxState = useAppSelector((state) => state.crmMail.data.inbox)
    const selectedAccountId = inboxState.selectedAccountId
    const selectedAccount = selectedAccountId
        ? inboxState.accounts.find((account) => account.id === selectedAccountId)
        : undefined

    const onCcClick = () => {
        setShowCC(!showCC)
    }

    const onBccClick = () => {
        setShowBcc(!showBcc)
    }

    const parseRecipients = (value?: string) => {
        if (!value) {
            return []
        }
        return value
            .split(/[,;]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    }

    const composeMetadata = () => {
        const metadata: Record<string, unknown> = {
            localState: mode,
            sentFrom: 'crm-dashboard',
            updatedAt: new Date().toISOString(),
        }
        if (mail.label) {
            metadata.labels = [mail.label]
        }
        if (mail.group) {
            metadata.group = mail.group
        }
        if (mail.starred !== undefined) {
            metadata.starred = mail.starred
        }
        if (mail.flagged !== undefined) {
            metadata.flagged = mail.flagged
        }
        return metadata
    }

    const handleSend = async (values: FormModel) => {
        if (!selectedAccountId) {
            toast.push(
                <Notification
                    type="danger"
                    title={t('crm.mail.noAccountSelected', {
                        defaultValue: 'Select an email account before sending.',
                    })}
                />,
                { placement: 'top-center' },
            )
            return
        }

        const to = parseRecipients(values.to)
        if (to.length === 0) {
            formikRef.current?.setFieldError('to', t('text.validation.receiverRequired'))
            return
        }

        const cc = parseRecipients(values.cc)
        const bcc = parseRecipients(values.bcc)
        const htmlBody = values.message || ''
        if (isRichTextEmpty(htmlBody)) {
            const formik = formikRef.current
            const messageKey = 'text.validation.messageBodyRequired'
            const translated = t(messageKey, {
                defaultValue: 'Message body is required.',
            })
            formik?.setFieldTouched('message', true, false)
            formik?.setFieldError('message', translated)
            return
        }
        const plainTextBody = extractPlainText(htmlBody)
        const payload = {
            subject: values.title,
            to,
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            bodyHtml: htmlBody || undefined,
            bodyText: plainTextBody || undefined,
            metadata: composeMetadata(),
            fromAddress: selectedAccount?.address || undefined,
            fromName: selectedAccount?.displayName || undefined,
            replyToRemoteId: mode === 'reply' && mail.remoteId ? String(mail.remoteId) : undefined,
        }

        setIsSubmitting(true)
        try {
            await dispatch(
                sendInboxMessage({
                    accountId: selectedAccountId,
                    payload,
                }),
            ).unwrap()

            toast.push(<Notification type="success" title={t('crm.mail.sent')} />, {
                placement: 'top-center',
            })

            formikRef.current?.resetForm()
            if (mode === 'reply') {
                dispatch(updateReply(false))
            }
            if (mode === 'new') {
                dispatch(toggleNewMessageDialog(false))
            }
        } catch (error) {
            const message =
                (error as Error)?.message ||
                t('crm.mail.sendFailed', {
                    defaultValue: 'Unable to send your message. Please try again.',
                })
            toast.push(
                <Notification type="danger" title={t('crm.mail.sendFailedTitle', {
                    defaultValue: 'Failed to send message',
                })}>
                    {message}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatErrorMessage = (error?: string) =>
        error ? t(error, { defaultValue: error }) : undefined

    return (
        <Formik
            innerRef={formikRef}
            initialValues={{
                title: mode === 'reply' ? `Re: ${mail?.title}` : '',
                to: mode === 'reply' ? mail?.from || '' : '',
                cc: '',
                bcc: '',
                message: '',
            }}
            validationSchema={validationSchema}
            onSubmit={async (values) => {
                if (isSubmitting) {
                    return
                }
                await handleSend(values)
            }}
        >
            {({ touched, errors }) => (
                <Form>
                    <FormContainer>
                        <FormItem
                            className={mode === 'reply' ? 'hidden!' : ''}
                            label={t('text.labels.title')}
                            labelClass="justify-start!"
                            invalid={errors.title && touched.title}
                            errorMessage={formatErrorMessage(errors.title)}
                        >
                            <Field
                                autoComplete="off"
                                name="title"
                                component={Input}
                            />
                        </FormItem>
                        <FormItem
                            className={mode === 'reply' ? 'hidden!' : ''}
                            label={t('text.labels.to')}
                            labelClass="justify-start!"
                            invalid={errors.to && touched.to}
                            errorMessage={formatErrorMessage(errors.to)}
                        >
                            <Field
                                autoComplete="off"
                                name="to"
                                component={Input}
                                suffix={
                                    <div className="flex">
                                        <span
                                            className="cursor-pointer select-none hover:underline ltr:mr-2 rtl:ml-2"
                                            onClick={onCcClick}
                                        >
                                            {t('text.labels.cc')}
                                        </span>
                                        <span
                                            className="cursor-pointer select-none hover:underline"
                                            onClick={onBccClick}
                                        >
                                            {t('text.labels.bcc')}
                                        </span>
                                    </div>
                                }
                            />
                        </FormItem>
                        <FormItem
                            className={!showCC ? 'hidden!' : ''}
                            label={t('text.labels.cc')}
                            labelClass="justify-start!"
                            invalid={errors.cc && touched.cc}
                            errorMessage={formatErrorMessage(errors.cc)}
                        >
                            <Field
                                autoComplete="off"
                                name="cc"
                                component={Input}
                            />
                        </FormItem>
                        <FormItem
                            className={!showBcc ? 'hidden!' : ''}
                            label={t('text.labels.bcc')}
                            labelClass="justify-start!"
                            invalid={errors.bcc && touched.bcc}
                            errorMessage={formatErrorMessage(errors.bcc)}
                        >
                            <Field
                                autoComplete="off"
                                name="bcc"
                                component={Input}
                            />
                        </FormItem>
                        <FormItem
                            label={mode === 'new' ? t('text.labels.message') : ''}
                            className="mb-0"
                            labelClass="justify-start!"
                            invalid={errors.message && touched.message}
                            errorMessage={formatErrorMessage(errors.message)}
                        >
                            <Field name="message">
                                {({ field, form }: FieldProps) => (
                                    <RichTextEditor
                                        ref={editorRef}
                                        value={field.value}
                                        onChange={(val) =>
                                            form.setFieldValue(field.name, val)
                                        }
                                    />
                                )}
                            </Field>
                        </FormItem>
                        {isSubmitting && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t('crm.mail.sendingMessage', {
                                    defaultValue: 'Sending your message…',
                                })}
                            </div>
                        )}
                    </FormContainer>
                </Form>
            )}
        </Formik>
    )
})

MailEditor.displayName = 'MailEditor'

export default MailEditor
