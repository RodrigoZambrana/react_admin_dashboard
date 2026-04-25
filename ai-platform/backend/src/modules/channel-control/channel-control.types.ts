import { z } from 'zod';

export const channelControlKeySchema = z.enum([
  'meta',
  'whatsappQr',
  'email',
  'webchat',
]);
export type ChannelControlKey = z.infer<typeof channelControlKeySchema>;

export const channelAdapterKeySchema = z.enum([
  'meta',
  'whatsapp_qr',
  'email',
  'webchat',
]);
export type ChannelAdapterKey = z.infer<typeof channelAdapterKeySchema>;

export const channelScopeSchema = z.enum([
  'customer_public',
  'customer_authenticated',
  'admin_internal',
]);
export type ChannelScope = z.infer<typeof channelScopeSchema>;

export const channelSecretRefSchema = z.object({
  strategy: z.enum(['local', 'env']).default('local'),
  ref: z.string().min(1),
});
export type ChannelSecretRef = z.infer<typeof channelSecretRefSchema>;

export const channelRouteDefaultsSchema = z.object({
  inboxKey: z.string().min(1).nullable().default(null),
  queueKey: z.string().min(1).nullable().default(null),
  scope: channelScopeSchema.default('customer_public'),
});
export type ChannelRouteDefaults = z.infer<typeof channelRouteDefaultsSchema>;

export const metaChannelControlSchema = z.object({
  enabled: z.boolean().default(false),
  messengerEnabled: z.boolean().default(false),
  instagramEnabled: z.boolean().default(false),
  publicBaseUrl: z.string().url().nullable().default(null),
  pageId: z.string().min(1).nullable().default(null),
  instagramBusinessAccountId: z.string().min(1).nullable().default(null),
  appId: z.string().min(1).nullable().default(null),
  verifyTokenRef: channelSecretRefSchema.nullable().default(null),
  appSecretRef: channelSecretRefSchema.nullable().default(null),
  pageAccessTokenRef: channelSecretRefSchema.nullable().default(null),
  messengerPageAccessTokenRef: channelSecretRefSchema.nullable().default(null),
  instagramAccessTokenRef: channelSecretRefSchema.nullable().default(null),
  route: channelRouteDefaultsSchema.default({
    inboxKey: null,
    queueKey: null,
    scope: 'customer_public',
  }),
});
export type MetaChannelControl = z.infer<typeof metaChannelControlSchema>;

export const whatsappQrChannelControlSchema = z.object({
  enabled: z.boolean().default(false),
  displayName: z.string().min(1).default('WhatsApp QR'),
  address: z.string().min(1).nullable().default(null),
  autoStart: z.boolean().default(true),
  typingIndicatorEnabled: z.boolean().default(true),
  presenceIndicatorEnabled: z.boolean().default(true),
  humanDelayEnabled: z.boolean().default(true),
  minReplyDelayMs: z.number().int().min(0).max(300000).default(3000),
  maxReplyDelayMs: z.number().int().min(0).max(300000).default(9000),
  maxOutboundPerHour: z.number().int().min(1).max(1000).default(40),
  maxOutboundPerDay: z.number().int().min(1).max(10000).default(250),
  reactionsEnabled: z.boolean().default(true),
  readReceiptsEnabled: z.boolean().default(true),
  allowProactiveOutbound: z.boolean().default(false),
  quietHoursStart: z.string().min(1).nullable().default(null),
  quietHoursEnd: z.string().min(1).nullable().default(null),
  route: channelRouteDefaultsSchema.default({
    inboxKey: null,
    queueKey: null,
    scope: 'customer_public',
  }),
});
export type WhatsappQrChannelControl = z.infer<
  typeof whatsappQrChannelControlSchema
>;

export const emailSecurityOptionSchema = z.enum(['SSL_TLS', 'STARTTLS', 'NONE']);
export type EmailSecurityOption = z.infer<typeof emailSecurityOptionSchema>;

export const emailChannelControlSchema = z.object({
  enabled: z.boolean().default(false),
  displayName: z.string().min(1).default('Inbox Email'),
  address: z.string().email().nullable().default(null),
  imapHost: z.string().min(1).nullable().default(null),
  imapPort: z.number().int().positive().nullable().default(null),
  imapSecurity: emailSecurityOptionSchema.default('SSL_TLS'),
  smtpHost: z.string().min(1).nullable().default(null),
  smtpPort: z.number().int().positive().nullable().default(null),
  smtpSecurity: emailSecurityOptionSchema.default('STARTTLS'),
  usernameRef: channelSecretRefSchema.nullable().default(null),
  passwordRef: channelSecretRefSchema.nullable().default(null),
  fromAddress: z.string().email().nullable().default(null),
  fromName: z.string().min(1).nullable().default(null),
  maxAttachmentSizeMb: z.number().positive().default(25),
  ratePerMinute: z.number().positive().default(60),
  pollIntervalMs: z.number().int().positive().default(120000),
  pollBatchSize: z.number().int().positive().default(50),
  route: channelRouteDefaultsSchema.default({
    inboxKey: null,
    queueKey: null,
    scope: 'customer_public',
  }),
});
export type EmailChannelControl = z.infer<typeof emailChannelControlSchema>;

export const webchatChannelControlSchema = z.object({
  enabled: z.boolean().default(true),
  allowAnonymous: z.boolean().default(true),
  allowAuthenticated: z.boolean().default(true),
  widgetVariant: z.string().min(1).default('storefront'),
  defaultLocale: z.string().min(1).default('es-UY'),
  defaultCurrency: z.string().min(1).default('UYU'),
  typingIndicatorsEnabled: z.boolean().default(true),
  stabilizationWindowMs: z.number().int().positive().default(900),
  route: channelRouteDefaultsSchema.default({
    inboxKey: null,
    queueKey: null,
    scope: 'customer_public',
  }),
});
export type WebchatChannelControl = z.infer<
  typeof webchatChannelControlSchema
>;

export const sharedRoutingControlSchema = z.object({
  defaultQueueKey: z.string().min(1).nullable().default(null),
  queueHeaderKey: z.string().min(1).default('x-queue'),
  defaultScope: channelScopeSchema.default('customer_public'),
});
export type SharedRoutingControl = z.infer<typeof sharedRoutingControlSchema>;

export const channelControlResourceSchema = z.object({
  meta: metaChannelControlSchema.default({}),
  whatsappQr: whatsappQrChannelControlSchema.default({}),
  email: emailChannelControlSchema.default({}),
  webchat: webchatChannelControlSchema.default({}),
  routing: sharedRoutingControlSchema.default({}),
});
export type ChannelControlResource = z.infer<typeof channelControlResourceSchema>;

export function buildDefaultChannelControlResource(): ChannelControlResource {
  return channelControlResourceSchema.parse({});
}

export const channelConnectionHealthSchema = z.enum([
  'healthy',
  'degraded',
  'offline',
  'unknown',
]);
export type ChannelConnectionHealth = z.infer<
  typeof channelConnectionHealthSchema
>;

export const channelConnectionStateSchema = z.object({
  channelKey: channelControlKeySchema,
  driver: z.string().min(1),
  enabled: z.boolean().default(false),
  connectionState: z.string().min(1).default('unknown'),
  health: channelConnectionHealthSchema.default('unknown'),
  summary: z.string().min(1).nullable().default(null),
  capabilities: z.record(z.boolean()).default({}),
  payload: z.record(z.string(), z.unknown()).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  observedAt: z.string().datetime(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type ChannelConnectionState = z.infer<
  typeof channelConnectionStateSchema
>;

export function toChannelControlKey(channel: string): ChannelControlKey {
  const normalized = String(channel || '').trim();

  switch (normalized) {
    case 'meta':
      return 'meta';
    case 'whatsapp_qr':
    case 'whatsapp-qr':
    case 'whatsappQr':
      return 'whatsappQr';
    case 'email':
      return 'email';
    case 'webchat':
      return 'webchat';
    default:
      throw new Error(`Unsupported channel key "${channel}".`);
  }
}

export function toChannelAdapterKey(channel: string): ChannelAdapterKey {
  const normalized = String(channel || '').trim();

  switch (normalized) {
    case 'meta':
      return 'meta';
    case 'whatsapp_qr':
    case 'whatsapp-qr':
    case 'whatsappQr':
      return 'whatsapp_qr';
    case 'email':
      return 'email';
    case 'webchat':
      return 'webchat';
    default:
      throw new Error(`Unsupported channel key "${channel}".`);
  }
}
