import { ResponseFallbackService } from '../src/modules/response-fallback/response-fallback.service';

describe('ResponseFallbackService', () => {
  it('renders fallback copy from the governed catalog instead of inline service strings', async () => {
    const service = new ResponseFallbackService(
      {
        resolveCatalog: jest.fn(async (locale?: string | null) => ({
          locale: locale?.startsWith('es') ? 'es' : 'default',
          templates: {
            basic_response:
              locale?.startsWith('es')
                ? 'Entiendo. Como puedo ayudarte?'
                : 'Hello, how can I help you?',
            clarification_requested_date: '',
            clarification_user_goal: '',
            clarification_generic: '',
            execution_success_booking:
              'The booking was confirmed for {{scheduledFor}}.',
            execution_success_quote: '',
            execution_success_product: '',
            execution_success_generic: '',
            execution_failure_unknown_tool: '',
            execution_failure_validation: '',
            execution_failure_generic: '',
          },
          actionLabels: {
            create_booking: 'the requested booking',
            create_quote: 'the requested quote',
            get_product: 'the requested product lookup',
            default: 'the approved request',
          },
          defaults: {
            scheduledFor: 'the requested date',
            currency: 'USD',
            amount: '0.00',
            productName: 'the requested product',
          },
        })),
        listActive: jest.fn(async () => []),
      } as any,
      {
        list: jest.fn(),
        createVersion: jest.fn(),
      } as any,
      {
        debug: jest.fn(),
        log: jest.fn(),
      } as any,
    );

    await expect(
      service.render({
        locale: 'es-UY',
        templateKey: 'basic_response',
      }),
    ).resolves.toBe('Entiendo. Como puedo ayudarte?');

    await expect(
      service.render({
        locale: 'en',
        templateKey: 'execution_success_booking',
        variables: {
          scheduledFor: '2026-04-04T12:00:00.000Z',
        },
      }),
    ).resolves.toBe('The booking was confirmed for 2026-04-04T12:00:00.000Z.');
  });
});
