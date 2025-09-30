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
    Mail,
} from '../store'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import type { RichTextEditorRef } from '@/components/shared/RichTextEditor'

const validationSchema = Yup.object().shape({
    title: Yup.string().required('text.validation.titleRequired'),
    to: Yup.string().required('text.validation.receiverRequired'),
    cc: Yup.string(),
    bcc: Yup.string(),
    message: Yup.string(),
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

    const onCcClick = () => {
        setShowCC(!showCC)
    }

    const onBccClick = () => {
        setShowBcc(!showBcc)
    }

    const onSend = () => {
        toast.push(<Notification type="success" title={t('crm.mail.sent')} />, {
            placement: 'top-center',
        })

        if (mode === 'reply') {
            dispatch(updateReply(false))
        }

        if (mode === 'new') {
            dispatch(toggleNewMessageDialog(false))
        }
    }

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
            onSubmit={() => {
                onSend()
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
                            errorMessage={errors.title}
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
                            errorMessage={errors.to}
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
                            errorMessage={errors.cc}
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
                            errorMessage={errors.bcc}
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
                            errorMessage={errors.message}
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
                    </FormContainer>
                </Form>
            )}
        </Formik>
    )
})

MailEditor.displayName = 'MailEditor'

export default MailEditor
