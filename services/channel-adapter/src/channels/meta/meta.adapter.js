import { normalizeMetaPayload } from '../../normalization/unified-message.js'

export class MetaAdapter {
  async handleInbound(payload) {
    return {
      normalized: normalizeMetaPayload(payload),
    }
  }
}
