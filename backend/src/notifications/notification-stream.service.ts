import { Injectable, MessageEvent } from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import {
  Notification,
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  User,
  Customer,
} from '@prisma/client'

export type NotificationBroadcast = {
  notification: NotificationPayload
  audience: NotificationAudience
  userId?: number | null
  customerId?: number | null
}

export type NotificationPayload = Omit<
  Pick<
    Notification,
    | 'id'
    | 'eventType'
    | 'audience'
    | 'channel'
    | 'deliveryStatus'
    | 'title'
    | 'body'
    | 'readAt'
    | 'readed'
    | 'createdAt'
    | 'updatedAt'
  >,
  never
> & {
  metadata: Record<string, unknown> | null
  orderId?: number | null
  paymentId?: number | null
  customer?: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'email'> | null
  recipient?: Pick<User, 'id' | 'name' | 'lastName' | 'email'> | null
}

@Injectable()
export class NotificationStreamService {
  private readonly stream$ = new Subject<NotificationBroadcast>()
  private counter = 0

  emit(event: NotificationBroadcast) {
    this.stream$.next(event)
  }

  streamForUser(userId: number): Observable<MessageEvent> {
    return this.stream(event => event.userId === userId)
  }

  streamForCustomer(customerId: number): Observable<MessageEvent> {
    return this.stream(event => event.customerId === customerId)
  }

  private stream(predicate: (event: NotificationBroadcast) => boolean): Observable<MessageEvent> {
    return this.stream$.asObservable().pipe(
      filter(predicate),
      map((event) => ({
        id: this.buildEventId(),
        type: this.resolveEventType(event.notification.eventType, event.notification.channel),
        data: event.notification,
      })),
    )
  }

  private buildEventId(): string {
    this.counter += 1
    return `${Date.now().toString(36)}-${this.counter.toString(36)}`
  }

  private resolveEventType(
    eventType: NotificationEventType | null,
    channel: NotificationChannel | null,
  ): string {
    const base = eventType ? `notification.${eventType.toLowerCase()}` : 'notification.unknown'
    return channel ? `${base}.${channel.toLowerCase()}` : base
  }
}
