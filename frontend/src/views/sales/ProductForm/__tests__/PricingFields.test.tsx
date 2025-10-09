import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PricingFields from '../PricingFields'
import { Formik, Form } from 'formik'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import i18n from 'i18next'

vi.mock('@/components/shared/AdaptableCard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/shared/CurrencySelector', () => ({
  default: ({ onChange, value }: { onChange: (code: string) => void; value: string }) => (
    <select data-testid="currency-selector" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="UYU">UYU</option>
      <option value="USD">USD</option>
    </select>
  ),
}))

const testI18n = i18n.createInstance()
testI18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'text.columns.costPrice': 'Cost price',
        'text.columns.salePrice': 'Sale price',
        'text.labels.offerPrice': 'Offer price',
        'text.descriptions.salePriceAuto': 'Auto message',
      },
    },
  },
})

const renderPricingFields = () => {
  render(
    <I18nextProvider i18n={testI18n}>
      <Formik
        initialValues={{ costPrice: '', salePrice: '', bulkDiscountPrice: '', currency: 'UYU' }}
        onSubmit={() => undefined}
      >
        {(formik) => (
          <Form>
            <PricingFields
              touched={formik.touched as any}
              errors={formik.errors as any}
              currency={formik.values.currency as any}
              onCurrencyChange={(code) => formik.setFieldValue('currency', code)}
            />
          </Form>
        )}
      </Formik>
    </I18nextProvider>,
  )
}

describe('PricingFields', () => {
  it('auto-fills sale price when cost price is provided', async () => {
    renderPricingFields()
    const user = userEvent.setup()
    const costInput = screen.getByPlaceholderText('Cost price') as HTMLInputElement
    await user.clear(costInput)
    await user.type(costInput, '100')
    const saleInput = screen.getByPlaceholderText('Sale price') as HTMLInputElement
    await waitFor(() => {
      expect(saleInput.value).toBe('130.00')
    })
  })

  it('retains manually edited sale price when cost changes', async () => {
    renderPricingFields()
    const user = userEvent.setup()
    const costInput = screen.getByPlaceholderText('Cost price') as HTMLInputElement
    const saleInput = screen.getByPlaceholderText('Sale price') as HTMLInputElement

    await user.clear(costInput)
    await user.type(costInput, '80')
    await waitFor(() => {
      expect(saleInput.value).toBe('104.00')
    })

    await user.click(saleInput)
    await user.keyboard('{End}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}')
    await user.type(saleInput, '150')
    await waitFor(() => {
      expect(saleInput.value).toBe('150')
    })

    await user.clear(costInput)
    await user.type(costInput, '90')
    expect(saleInput.value).toBe('150')
  })
})
