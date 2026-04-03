import { ZodError } from 'zod';

import { TemporalLocaleService } from '../src/modules/temporal/temporal-locale.service';

describe('TemporalLocaleService', () => {
  it('maps active managed temporal locales into admin-facing response objects', async () => {
    const service = new TemporalLocaleService(
      {
        listActive: jest.fn(async () => [
          {
            id: 'locale-1',
            key: 'es',
            value: {
              locale: 'es',
              datePhrases: ['mañana'],
              timeJoiners: ['a las'],
            },
            version: 2,
            status: 'ACTIVE',
            metadata: {
              origin: 'admin',
            },
            createdAt: new Date('2026-04-03T00:00:00.000Z'),
            createdBy: 'admin',
          },
        ]),
      } as any,
      {
        list: jest.fn(async () => []),
        createVersion: jest.fn(),
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(service.listActiveLocales()).resolves.toEqual([
      expect.objectContaining({
        locale: 'es',
        resource: expect.objectContaining({
          locale: 'es',
        }),
        version: 2,
        status: 'ACTIVE',
      }),
    ]);
  });

  it('validates temporal locale payloads before storing a new admin version', async () => {
    const createVersion = jest.fn(async () => ({
      locale: 'es',
      version: 1,
      status: 'ACTIVE',
    }));
    const service = new TemporalLocaleService(
      {
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(async () => []),
        createVersion,
      } as any,
      {
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.createVersion({
        locale: 'es',
        resource: {
          locale: 'es',
          datePhrases: ['mañana'],
          timeJoiners: ['a las'],
        },
        activate: true,
        createdBy: 'admin',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        locale: 'es',
        version: 1,
      }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'es',
        activate: true,
      }),
    );

    await expect(
      service.createVersion({
        locale: 'es',
        resource: {
          locale: 'es',
          datePhrases: [],
          timeJoiners: [],
        } as any,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
