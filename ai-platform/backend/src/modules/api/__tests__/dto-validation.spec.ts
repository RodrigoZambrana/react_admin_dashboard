import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { InternalChannelInboundMessageDto } from '../dto/internal-channel-inbound-message.dto';
import { AdminConversationReplyDto } from '../dto/admin-conversation-reply.dto';
import { UpdateChannelConnectionStateDto } from '../../channel-control/dto/update-channel-connection-state.dto';
import { UpdateEmailInboxSettingsDto } from '../../channel-control/dto/update-email-inbox-settings.dto';
import { UpdateEmailChannelControlDto } from '../../channel-control/dto/update-email-channel-control.dto';
import { UpdateMetaChannelControlDto } from '../../channel-control/dto/update-meta-channel-control.dto';
import { UpdateWhatsappQrChannelControlDto } from '../../channel-control/dto/update-whatsapp-qr-channel-control.dto';

function validate<T extends object>(ctor: new () => T, payload: unknown) {
  const instance = plainToInstance(ctor, payload);
  return validateSync(instance as T, {
    whitelist: true,
    forbidUnknownValues: true,
  });
}

describe('DTO validation boundaries', () => {
  it('rejects invalid inbound channel payloads', () => {
    const errors = validate(InternalChannelInboundMessageDto, {
      tenantKey: 'urucortinas',
      channel: 'sms',
      userId: 123,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['channel', 'userId']));
  });

  it('rejects invalid email inbox settings', () => {
    const errors = validate(UpdateEmailInboxSettingsDto, {
      imapHost: 'mail.example.com',
      imapPort: 'abc',
      smtpPort: 0,
      fromAddress: 'not-an-email',
      maxAttachmentSizeMb: 1001,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['imapPort', 'smtpPort', 'fromAddress', 'maxAttachmentSizeMb']),
    );
  });

  it('rejects invalid channel connection state payloads', () => {
    const errors = validate(UpdateChannelConnectionStateDto, {
      driver: '',
      enabled: 'yes',
      connectionState: 123,
      health: 'broken',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['enabled', 'connectionState', 'health']));
  });

  it('rejects empty string references in email channel settings', () => {
    const errors = validate(UpdateEmailChannelControlDto, {
      usernameRef: { ref: '', strategy: 'local' },
      route: { inboxKey: '', queueKey: '', scope: 'customer_public' },
    });

    const properties = errors.flatMap((error) => [
      error.property,
      ...(error.children?.map((child) => child.property) ?? []),
    ]);
    expect(properties).toEqual(expect.arrayContaining(['usernameRef', 'route']));
  });

  it('rejects empty string references in meta and whatsapp qr channel settings', () => {
    const metaErrors = validate(UpdateMetaChannelControlDto, {
      verifyTokenRef: { ref: '', strategy: 'local' },
      route: { inboxKey: '', queueKey: '', scope: 'admin_internal' },
    });
    const waErrors = validate(UpdateWhatsappQrChannelControlDto, {
      route: { inboxKey: '', queueKey: '', scope: 'customer_public' },
    });

    expect(metaErrors.length).toBeGreaterThan(0);
    expect(waErrors.length).toBeGreaterThan(0);
  });

  it('rejects inbound channel messages with empty identifiers', () => {
    const errors = validate(InternalChannelInboundMessageDto, {
      tenantKey: '',
      channel: 'email',
      userId: '',
      threadId: '',
      externalMessageId: '',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['tenantKey', 'userId', 'threadId', 'externalMessageId']));
  });

  it('rejects manual replies that are only whitespace', () => {
    const errors = validate(AdminConversationReplyDto, {
      body: '   ',
      kind: 'text',
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['body']),
    );
  });
});
