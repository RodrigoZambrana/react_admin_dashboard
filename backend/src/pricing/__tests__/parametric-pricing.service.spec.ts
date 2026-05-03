import { describe, expect, it } from 'vitest'
import { ParametricPricingService } from '../parametric-pricing.service'

describe('ParametricPricingService product naming', () => {
  const service = new ParametricPricingService(
    {} as never,
    {
      slug: 'urucortinas',
      featureFlags: { PARAMETRIC_PRODUCTS: true },
    } as never,
    {} as never,
  )

  it('generates the standard CSV product name from family, series and size', () => {
    const name = (service as any).buildProductName(
      undefined,
      'VENTANA_CORREDIZA_2H2G',
      'PROBBA',
      'NEGRO',
      'DVH(4/9/5)',
      116,
      72,
      false,
    )

    expect(name).toBe('Ventana Corrediza Probba Negro DVH(4/9/5) 116x72')
  })

  it('keeps an explicit product_name when the CSV already provides one', () => {
    const name = (service as any).buildProductName(
      'Ventana Corrediza 2H2G Probba 116x72',
      'VENTANA_CORREDIZA_2H2G',
      'PROBBA',
      'NEGRO',
      'DVH(4/9/5)',
      116,
      72,
      false,
    )

    expect(name).toBe('Ventana Corrediza 2H2G Probba 116x72')
  })
})
