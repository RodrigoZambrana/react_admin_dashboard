import { Injectable } from '@nestjs/common'

import { Ga4ConnectorService } from '../ga4-connector.service'

@Injectable()
export class Ga4InitialSyncJob {
  constructor(private readonly ga4Connector: Ga4ConnectorService) {}

  run(connectionId: string) {
    return this.ga4Connector.runInitialSync(connectionId)
  }
}

