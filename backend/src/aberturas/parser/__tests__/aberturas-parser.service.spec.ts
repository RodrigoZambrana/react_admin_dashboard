import { describe, expect, it, vi } from 'vitest'
import { AberturasParserService } from '../aberturas-parser.service'

const createService = () => {
  const glossary = {
    listGrouped: vi.fn().mockResolvedValue({
      tipo: [
        { label: 'CORREDIZA', value: 'VENTANA_CORREDIZA' },
        { label: 'PUERTA BATIENTE 1H', value: 'PUERTA_BATIENTE_1H' },
      ],
      serie: [
        { label: 'PROBBA', value: 'PROBBA' },
        { label: 'GALA', value: 'GALA' },
      ],
      color: [
        { label: 'BLANCO', value: 'BLANCO' },
        { label: 'NEGRO', value: 'NEGRO' },
      ],
      vidrio: [
        { label: '4MM', value: '4MM' },
        { label: 'DVH (4/9/5)', value: 'DVH(4/9/5)' },
      ],
    }),
    getConfig: vi.fn().mockResolvedValue({
      nearest: {
        maxResults: 3,
      },
    }),
  }

  return {
    service: new AberturasParserService(glossary as never),
    glossary,
  }
}

describe('AberturasParserService', () => {
  it('parses a simple opening line into a deterministic structured item', async () => {
    const { service } = createService()

    const result = await service.buildParsedContext({
      text: 'Corrediza Probba blanco vidrio simple de 1.10 x 1.20',
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      familyId: 'VENTANA_CORREDIZA',
      serie: 'PROBBA',
      color: 'BLANCO',
      vidrio: 'VIDRIO SIMPLE',
      widthMm: 1100,
      heightMm: 1200,
      material: 'ALUMINIO',
    })
  })

  it('splits semicolon-separated lines and preserves explicit price only where present', async () => {
    const { service } = createService()

    const result = await service.buildParsedContext({
      text:
        'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234; Gala corrediza con DVH color negro de 1.90 x 2.20',
    })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      serie: 'PROBBA',
      widthMm: 1100,
      heightMm: 1200,
      price: 234,
      currency: 'USD',
    })
    expect(result.items[1]).toMatchObject({
      serie: 'GALA',
      widthMm: 1900,
      heightMm: 2200,
      price: null,
      currency: null,
    })
  })
})
