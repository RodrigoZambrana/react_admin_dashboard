import { Global, Module } from '@nestjs/common'
import { CurrencyConversionService } from './currency-conversion.service'

@Global()
@Module({
  providers: [CurrencyConversionService],
  exports: [CurrencyConversionService],
})
export class CurrencyModule {}
