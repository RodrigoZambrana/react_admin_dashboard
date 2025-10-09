import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common'
import { sanitizeInput } from '../utils/sanitize'

@Injectable()
export class SanitizeInputPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (value === null || value === undefined) {
      return value
    }

    if (metadata.type === 'body' || metadata.type === 'query' || metadata.type === 'param') {
      return sanitizeInput(value as never)
    }

    return value
  }
}

