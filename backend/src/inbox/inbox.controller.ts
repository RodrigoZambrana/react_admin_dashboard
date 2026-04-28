import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
  Put,
} from '@nestjs/common'
import type { MessageEvent } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { InboxService } from './inbox.service'
import { ListMessagesQueryDto } from './dto/list-messages.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { UpdateFlagsDto } from './dto/update-flags.dto'
import { MoveMessageDto } from './dto/move-message.dto'
import { SyncMailboxDto } from './dto/sync-mailbox.dto'
import { GetMessageQueryDto } from './dto/get-message.dto'
import { UpsertInboxAccountDto, UpdateInboxAccountDto } from './dto/upsert-account.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('accounts')
  listAccounts(
    @Query('channel') channel?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeUnconfigured') includeUnconfigured?: string,
  ) {
    return this.inboxService.listAccounts({
      channel,
      includeInactive: includeInactive === 'true',
      includeUnconfigured: includeUnconfigured === 'true',
    })
  }

  @Post('accounts')
  createAccount(@Body() body: UpsertInboxAccountDto) {
    return this.inboxService.createAccount({
      address: body.address,
      displayName: body.displayName ?? null,
      active: body.active ?? true,
    })
  }

  @Put('accounts/:accountId')
  updateAccount(
    @Param('accountId') accountId: string,
    @Body() body: UpdateInboxAccountDto,
  ) {
    return this.inboxService.updateAccount(accountId, {
      address: body.address ?? undefined,
      displayName: body.displayName ?? null,
      active: body.active,
    })
  }

  @Delete('accounts/:accountId')
  deactivateAccount(@Param('accountId') accountId: string) {
    return this.inboxService.deactivateAccount(accountId)
  }

  @Get('accounts/:accountId/mailboxes')
  listMailboxes(@Param('accountId') accountId: string) {
    return this.inboxService.listMailboxes(accountId)
  }

  @Get('accounts/:accountId/messages')
  listMessages(
    @Param('accountId') accountId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.inboxService.listMessages(accountId, {
      mailbox: query.mailbox,
      cursor: query.cursor,
      limit: query.limit,
      since: query.since,
    })
  }

  @Get('accounts/:accountId/threads')
  listThreads(
    @Param('accountId') accountId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.inboxService.listThreads(accountId, {
      mailbox: query.mailbox,
      cursor: query.cursor,
      limit: query.limit,
      since: query.since,
    })
  }

  @Get('accounts/:accountId/messages/:remoteId')
  getMessage(
    @Param('accountId') accountId: string,
    @Param('remoteId') remoteId: string,
    @Query() query: GetMessageQueryDto,
  ) {
    return this.inboxService.getMessage(accountId, {
      remoteId,
      threadRemoteId: query.threadRemoteId,
    })
  }

  @Post('accounts/:accountId/messages/send')
  sendMessage(
    @Param('accountId') accountId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.inboxService.sendMessage(accountId, {
      subject: body.subject,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      replyTo: body.replyTo,
      replyToRemoteId: body.replyToRemoteId,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      attachments: body.attachments?.map((attachment) => ({
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
      metadata: body.metadata,
      fromAddress: body.fromAddress,
      fromName: body.fromName,
      queueId: body.queueId,
      queueSlug: body.queueSlug,
    })
  }

  @Post('accounts/:accountId/messages/:remoteId/flags')
  updateFlags(
    @Param('accountId') accountId: string,
    @Param('remoteId') remoteId: string,
    @Body() body: UpdateFlagsDto,
  ) {
    return this.inboxService.setFlags(
      accountId,
      {
        remoteId,
        threadRemoteId: body.threadRemoteId,
        mailbox: body.mailbox,
      },
      {
        seen: body.seen,
        starred: body.starred,
        spam: body.spam,
        metadata: body.metadata,
      },
    )
  }

  @Post('accounts/:accountId/messages/:remoteId/move')
  moveMessage(
    @Param('accountId') accountId: string,
    @Param('remoteId') remoteId: string,
    @Body() body: MoveMessageDto,
  ) {
    return this.inboxService.moveMessage(
      accountId,
      {
        remoteId,
        threadRemoteId: body.threadRemoteId,
        mailbox: body.mailbox,
      },
      body.targetMailbox,
    )
  }

  @Post('accounts/:accountId/messages/:remoteId/spam')
  markAsSpam(
    @Param('accountId') accountId: string,
    @Param('remoteId') remoteId: string,
    @Body() body: UpdateFlagsDto,
  ) {
    return this.inboxService.markAsSpam(accountId, {
      remoteId,
      threadRemoteId: body.threadRemoteId,
      mailbox: body.mailbox,
    })
  }

  @Post('accounts/:accountId/sync')
  syncAccount(
    @Param('accountId') accountId: string,
    @Body() body: SyncMailboxDto,
  ) {
    return this.inboxService.synchronizeAccount(accountId, {
      mailboxes: body.mailboxes,
      limit: body.limit,
      cursor: body.cursor,
      since: body.since,
      fullHistory: body.fullHistory,
      maxPages: body.maxPages,
    })
  }

  @Sse('events/messages')
  streamMessages(
    @Query('queueId') queueId?: string,
    @Query('queueSlug') queueSlug?: string,
    @Query('accountId') accountId?: string,
  ): Observable<MessageEvent> {
    return this.inboxService.streamMessageEvents({
      queueId,
      queueSlug,
      accountId,
    })
  }
}
