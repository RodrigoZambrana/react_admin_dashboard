import { normalizeEmailPayload } from '../../normalization/unified-message.js'

export class EmailAdapter {
  async handleInbound(payload) {
    return {
      normalized: normalizeEmailPayload(payload),
    }
  }
}
