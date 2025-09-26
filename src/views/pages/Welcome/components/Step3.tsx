import { FormItem, FormContainer } from '@/components/ui/Form'
import Segment from '@/components/ui/Segment'
import Button from '@/components/ui/Button'
import { Field, Form, Formik } from 'formik'
import SegmentItemOption from '@/components/shared/SegmentItemOption'
import {
    HiOutlineCode,
    HiOutlineCube,
    HiOutlinePencil,
    HiOutlineShieldCheck,
    HiOutlineAcademicCap,
    HiOutlineSparkles,
    HiArrowSmLeft,
} from 'react-icons/hi'
import type { CallbackSetBack } from '../types'
import type { FieldProps } from 'formik'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Step3Props = CallbackSetBack

const roles: {
    value: string
    labelKey: string
    icon: ReactNode
    disabled?: boolean
}[] = [
    {
        value: 'softwareEngineer',
        labelKey: 'welcome.step3.roles.softwareEngineer',
        icon: <HiOutlineCode />,
    },
    {
        value: 'productManager',
        labelKey: 'welcome.step3.roles.productManager',
        icon: <HiOutlineCube />,
    },
    { value: 'designer', labelKey: 'welcome.step3.roles.designer', icon: <HiOutlinePencil /> },
    { value: 'qaTester', labelKey: 'welcome.step3.roles.qaTester', icon: <HiOutlineShieldCheck /> },
    {
        value: 'stakeholder',
        labelKey: 'welcome.step3.roles.stakeholder',
        icon: <HiOutlineAcademicCap />,
    },
    { value: 'other', labelKey: 'welcome.step3.roles.other', icon: <HiOutlineSparkles /> },
]

const Step3 = ({ onNext, onBack }: Step3Props) => {
    const { t } = useTranslation()
    return (
        <div className="text-center">
            <h3 className="mb-2">{t('welcome.step3.title')}</h3>
            <div className="mt-8 max-w-[600px] lg:min-w-[600px] mx-auto">
                <Formik
                    initialValues={{
                        role: '',
                    }}
                    onSubmit={() => {
                        // no-op
                    }}
                >
                    {({ touched, errors }) => {
                        return (
                            <Form>
                                <FormContainer>
                                    <FormItem
                                        invalid={errors.role && touched.role}
                                        errorMessage={errors.role}
                                    >
                                        <Field name="role">
                                            {({ field, form }: FieldProps) => (
                                                <Segment
                                                    value={[field.value]}
                                                    onChange={(val) => {
                                                        form.setFieldValue(
                                                            field.name,
                                                            val[0],
                                                        )
                                                        onNext?.()
                                                    }}
                                                >
                                                    <div className="grid grid-cols-2 gap-4 w-full">
                                                        {roles.map((item) => (
                                                            <Segment.Item
                                                                key={item.value}
                                                                value={item.value}
                                                                disabled={item.disabled}
                                                            >
                                                                {({
                                                                    active,
                                                                    onSegmentItemClick,
                                                                    disabled,
                                                                }) => {
                                                                    return (
                                                                        <SegmentItemOption
                                                                            hoverable
                                                                            active={active}
                                                                            disabled={disabled}
                                                                            className="bg-white dark:bg-gray-800 w-auto"
                                                                            onSegmentItemClick={
                                                                                onSegmentItemClick
                                                                            }
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <span className="text-2xl">
                                                                                    {item.icon}
                                                                                </span>
                                                                                <h6>{t(item.labelKey)}</h6>
                                                                            </div>
                                                                        </SegmentItemOption>
                                                                    )
                                                                }}
                                                            </Segment.Item>
                                                        ))}
                                                    </div>
                                                </Segment>
                                            )}
                                        </Field>
                                    </FormItem>
                                    <Button
                                        block
                                        variant="plain"
                                        type="button"
                                        icon={<HiArrowSmLeft />}
                                        onClick={onBack}
                                    >
                                        {t('text.actions.back')}
                                    </Button>
                                </FormContainer>
                            </Form>
                        )
                    })}
                </Formik>
            </div>
        </div>
    )
}

export default Step3
