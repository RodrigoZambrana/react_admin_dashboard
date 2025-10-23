import { Injectable, MessageEvent } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { filter, map } from 'rxjs/operators'

export type InboxBroadcast = {
  type: string
  message: Record<string, unknown>
  queueId?: string | null
  queueSlug?: string | null
  accountId?: string
  id?: string
}

export type InboxStreamFilter = {
  queueId?: string
  queueSlug?: string
  accountId?: string
}

@Injectable()
export class InboxEventsService {
  private readonly stream = new Subject<InboxBroadcast>()
  private eventCounter = 0

  emit(event: InboxBroadcast) {
    this.stream.next(event)
  }

  streamEvents(filterOptions: InboxStreamFilter = {}): Observable<MessageEvent> {
    const queueId = filterOptions.queueId?.toLowerCase()
    const queueSlug = filterOptions.queueSlug?.toLowerCase()
    const accountId = filterOptions.accountId

    return this.stream.asObservable().pipe(
      filter((event) => {
        if (queueId && event.queueId?.toLowerCase() !== queueId) {
          return false
        }
        if (queueSlug) {
          const eventSlug = event.queueSlug?.toLowerCase()
          if (eventSlug !== queueSlug) {
            return false
          }
        }
        if (accountId && event.accountId !== accountId) {
          return false
        }
        return true
      }),
      map((event) => ({
        type: event.type,
        data: event.message,
        id: event.id ?? this.buildEventId(),
      })),
    )
  }

  private buildEventId() {
    this.eventCounter += 1
    return `${Date.now().toString(36)}-${this.eventCounter.toString(36)}`
  }
}
