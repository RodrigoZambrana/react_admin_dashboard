import type { Provider } from '@nestjs/common'
import { CLIENT_CONFIG_TOKEN } from './client-config.constants'
import { loadClientConfig } from './client-config.loader'
import type { ClientVariantConfig } from './client-config.types'

export const ClientConfigProvider: Provider<ClientVariantConfig> = {
  provide: CLIENT_CONFIG_TOKEN,
  useFactory: () => loadClientConfig(),
}
