import { ChannelControlInternalController } from '../channel-control-internal.controller'

function createController() {
  const channelControlService = {
    getAdapterOverview: jest.fn().mockResolvedValue({ ok: true }),
    getAdapterChannelSnapshot: jest.fn().mockResolvedValue({ snapshot: true }),
    upsertConnectionState: jest.fn().mockResolvedValue({ updated: true }),
  } as any
  const configService = {
    get: jest.fn().mockReturnValue('test-internal-token'),
  } as any

  return {
    controller: new ChannelControlInternalController(channelControlService, configService),
    channelControlService,
    configService,
  }
}

describe('ChannelControlInternalController', () => {
  it('rejects requests with a missing internal token', async () => {
    const { controller } = createController()

    await expect(controller.getOverview(undefined)).rejects.toThrow('Invalid internal token.')
  })

  it('rejects requests with a wrong internal token', async () => {
    const { controller } = createController()

    await expect(controller.getChannelSnapshot('email', 'wrong-token')).rejects.toThrow(
      'Invalid internal token.',
    )
  })

  it('allows requests with the expected internal token', async () => {
    const { controller, channelControlService } = createController()

    await expect(controller.getOverview('test-internal-token')).resolves.toEqual({ ok: true })
    expect(channelControlService.getAdapterOverview).toHaveBeenCalledTimes(1)
  })
})
