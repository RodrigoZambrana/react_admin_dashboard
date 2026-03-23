export type SeedPaymentMethodDefinition = {
  id: number
  code: 'mercado_pago' | 'cash'
  label: string
  translations: Record<string, string>
}

const PAYMENT_METHODS: SeedPaymentMethodDefinition[] = [
  {
    id: 1,
    code: 'mercado_pago',
    label: 'Mercado Pago',
    translations: {
      es: 'Mercado Pago',
      en: 'Mercado Pago',
    },
  },
  {
    id: 2,
    code: 'cash',
    label: 'Efectivo',
    translations: {
      es: 'Efectivo',
      en: 'Cash',
    },
  },
]

export const listSeedPaymentMethods = () => PAYMENT_METHODS.map((method) => ({ ...method }))
