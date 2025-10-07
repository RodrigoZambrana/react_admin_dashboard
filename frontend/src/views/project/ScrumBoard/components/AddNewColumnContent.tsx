import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Formik, Field, Form } from 'formik'
import requiredFieldValidation from '@/utils/requiredFieldValidation'
import { closeDialog, createColumn, useAppDispatch } from '../store'
import { useTranslation } from 'react-i18next'

const AddNewColumnContent = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const onFormSubmit = (title: string) => {
        const trimmed = title.trim()
        const fallbackTitle = t('text.labels.untitledBoard', {
            defaultValue: 'Untitled Board',
        })
        dispatch(
            createColumn({
                title: trimmed ? trimmed : fallbackTitle,
            }),
        )
        dispatch(closeDialog())
    }

    return (
        <div>
            <h5>Add New Column</h5>
            <div className="mt-8">
                <Formik
                    initialValues={{ title: '' }}
                    onSubmit={({ title }) => onFormSubmit(title)}
                >
                    {({ errors, touched }) => (
                        <Form>
                            <FormContainer layout="inline">
                                <FormItem
                                    label="Column title"
                                    invalid={errors.title && touched.title}
                                    errorMessage={errors.title}
                                >
                                    <Field
                                        type="text"
                                        name="title"
                                        placeholder="Please enter ticket title"
                                        component={Input}
                                        validate={(value: string) =>
                                            requiredFieldValidation(
                                                value,
                                                'Ticket title is required!',
                                            )
                                        }
                                    />
                                </FormItem>
                                <FormItem>
                                    <Button variant="solid" type="submit">
                                        Add
                                    </Button>
                                </FormItem>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            </div>
        </div>
    )
}

export default AddNewColumnContent
