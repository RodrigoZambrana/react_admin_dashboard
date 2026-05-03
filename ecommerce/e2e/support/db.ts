import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { aiPlatformDatabaseUrl, databaseUrl, storefrontBaseUrl } from "./env";

type EmailActionEvent = "verify_email" | "reset_link";

type EmailActionLink = {
  url: string;
  subject: string;
  locale: string;
};

export type LatestOrderSnapshot = {
  uuid: string;
  orderCurrency: string;
  grandTotal: number;
  statusId: number;
  itemNames: string[];
  itemCount: number;
};

export type CustomerAddressSnapshot = {
  id: number;
  isPrimary: boolean;
  line1: string;
  line2: string | null;
  city: string;
  department: string | null;
  neighborhood: string | null;
  country: string;
};

export type OrderAddressSnapshot = {
  shippingCity: string | null;
  shippingDepartment: string | null;
  shippingNeighborhood: string | null;
  shippingCountry: string | null;
};

export type LatestPaymentSnapshot = {
  id: number;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
};

export type OrderTimelineEventSnapshot = {
  type: string;
  currency: string | null;
  amount: number | null;
  paymentMethod: string | null;
  statusFrom: string | null;
  statusTo: string | null;
};

export type OrderNotificationSnapshot = {
  eventType: string | null;
  audience: string | null;
  channel: string | null;
  title: string | null;
  body: string | null;
};

export type OrderEmailLogSnapshot = {
  category: string;
  recipientType: string;
  toAddress: string;
  subject: string;
  status: string;
};

export type ConversationOutboundSnapshot = {
  conversationId: string;
  inboxAccountId: string | null;
  remoteId: string | null;
  providerMessageId: string | null;
  deliveryStatus: string | null;
};

export type ApprovedMercadoPagoIntentSnapshot = {
  id: string;
  externalPaymentId: string;
};

export type AnalyticsEventSnapshot = {
  id: string;
  tenantId: string;
  eventName: string;
  eventId: string | null;
  schemaVersion: number;
  source: string | null;
  ingestionPath: string | null;
  componentId: string | null;
  ctaId: string | null;
  timestamp: string;
  createdAt: string;
};

export type AnalyticsFactSnapshot = {
  id: string;
  tenantId: string;
  eventName: string;
  eventId: string | null;
  schemaVersion: number;
  ingestionSource: string;
  ingestionPath: string | null;
  componentId: string | null;
  ctaId: string | null;
  sourceEventId: string;
  eventTimestamp: string;
  createdAt: string;
};

export type AnalyticsComparisonSnapshot = {
  id: string;
  tenantId: string;
  eventId: string;
  eventName: string;
  existsInDirect: boolean;
  existsInGa: boolean;
  payloadMatch: boolean;
  timeDiffMs: number | null;
  status: string;
  directSource: string | null;
  gaSource: string | null;
  comparisonDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeededConversationMessageSnapshot = {
  conversationId: string;
  messageId: string;
  rawEventId: string;
  candidateId: string;
};

function normalizeActionUrl(url: string): string {
  const target = new URL(url);
  const storefront = new URL(storefrontBaseUrl);

  target.protocol = storefront.protocol;
  target.host = storefront.host;

  return target.toString();
}

async function withClient<T>(
  callback: (client: Client) => Promise<T>,
  connectionString = databaseUrl
): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function waitForEmailActionLink(
  toAddress: string,
  event: EmailActionEvent,
  timeoutMs = 20_000
): Promise<EmailActionLink> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<EmailActionLink & { event: string | null }>(
        `
          SELECT
            subject,
            locale,
            payload ->> 'event' AS event,
            payload ->> 'resetUrl' AS url
          FROM "EmailLog"
          WHERE "toAddress" = $1
          ORDER BY "createdAt" DESC
          LIMIT 20
        `,
        [toAddress]
      )
    );

    const match = result.rows.find((row) => row.event === event && typeof row.url === "string" && row.url.length > 0);
    if (match?.url) {
      return {
        url: normalizeActionUrl(match.url),
        subject: match.subject,
        locale: match.locale
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${event} email for ${toAddress}`);
}

export async function waitForLatestOrderByCustomerEmail(
  email: string,
  timeoutMs = 20_000
): Promise<LatestOrderSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        uuid: string;
        orderCurrency: string;
        grandTotal: string;
        statusId: number;
        itemNames: string[] | null;
        itemCount: string;
      }>(
        `
          SELECT
            o.uuid,
            o."orderCurrency",
            o."grandTotal"::text AS "grandTotal",
            o."statusId",
            ARRAY(
              SELECT oi.name
              FROM "OrderItem" oi
              WHERE oi."orderId" = o.id
              ORDER BY oi.id ASC
            ) AS "itemNames",
            (
              SELECT COUNT(*)
              FROM "OrderItem" oi
              WHERE oi."orderId" = o.id
            )::text AS "itemCount"
          FROM "Order" o
          INNER JOIN "Customer" c ON c.id = o."customerId"
          WHERE c.email = $1
            AND o."documentType" = 'ORDER'
          ORDER BY o.id DESC
          LIMIT 1
        `,
        [email]
      )
    );

    const row = result.rows[0];
    if (row?.uuid) {
      return {
        uuid: row.uuid,
        orderCurrency: row.orderCurrency,
        grandTotal: Number(row.grandTotal),
        statusId: row.statusId,
        itemNames: row.itemNames ?? [],
        itemCount: Number(row.itemCount)
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for order for ${email}`);
}

export async function getLatestPaymentForOrder(orderUuid: string): Promise<LatestPaymentSnapshot | null> {
  const result = await withClient(async (client) =>
    client.query<{
      id: number;
      status: string;
      amount: string;
      currency: string;
      method: string | null;
    }>(
      `
        SELECT
          p.id,
          p.status,
          p.amount::text AS amount,
          p.currency,
          p.method
        FROM "Payment" p
        INNER JOIN "Order" o ON o.id = p."orderId"
        WHERE o.uuid = $1
        ORDER BY p.id DESC
        LIMIT 1
      `,
      [orderUuid]
    )
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    method: row.method
  };
}

export async function waitForLatestAnalyticsEventByEventId(
  eventId: string,
  timeoutMs = 20_000
): Promise<AnalyticsEventSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        id: string;
        tenantId: string;
        eventName: string;
        eventId: string | null;
        schemaVersion: number;
        source: string | null;
        componentId: string | null;
        ctaId: string | null;
        timestamp: Date;
      }>(
        `
          SELECT
            id,
            tenant_id AS "tenantId",
            event_name AS "eventName",
            event_id AS "eventId",
            schema_version AS "schemaVersion",
            source,
            component_id AS "componentId",
            cta_id AS "ctaId",
            timestamp
          FROM events
          WHERE event_id = $1
          ORDER BY timestamp DESC
          LIMIT 1
        `,
        [eventId]
      )
    );

    const row = result.rows[0];
    if (row?.id) {
      return {
        id: row.id,
        tenantId: row.tenantId,
        eventName: row.eventName,
        eventId: row.eventId,
        schemaVersion: row.schemaVersion,
        source: row.source,
        ingestionPath: null,
        componentId: row.componentId,
        ctaId: row.ctaId,
        timestamp: row.timestamp.toISOString(),
        createdAt: row.timestamp.toISOString()
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for analytics event ${eventId}`);
}

export async function waitForLatestAnalyticsEventByEventName(
  eventName: string,
  timeoutMs = 20_000,
  filters?: { tenantId?: string; payloadOrderId?: string; ctaId?: string; componentId?: string }
): Promise<AnalyticsEventSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) => {
      const conditions = ['event_name = $1'];
      const values: Array<string> = [eventName];

      if (filters?.tenantId) {
        conditions.push(`tenant_id = $${values.length + 1}`);
        values.push(filters.tenantId);
      }

      if (filters?.payloadOrderId) {
        conditions.push(
          `(payload -> 'data' ->> 'order_id' = $${values.length + 1} OR payload -> 'metadata' ->> 'order_id' = $${values.length + 1})`
        );
        values.push(filters.payloadOrderId);
      }

      if (filters?.ctaId) {
        conditions.push(`cta_id = $${values.length + 1}`);
        values.push(filters.ctaId);
      }

      if (filters?.componentId) {
        conditions.push(`component_id = $${values.length + 1}`);
        values.push(filters.componentId);
      }

      return client.query<{
        id: string;
        tenantId: string;
        eventName: string;
        eventId: string | null;
        schemaVersion: number;
        source: string | null;
        componentId: string | null;
        ctaId: string | null;
        timestamp: Date;
      }>(
        `
          SELECT
            id,
            tenant_id AS "tenantId",
            event_name AS "eventName",
            event_id AS "eventId",
            schema_version AS "schemaVersion",
            source,
            component_id AS "componentId",
            cta_id AS "ctaId",
            timestamp
          FROM events
          WHERE ${conditions.join(" AND ")}
          ORDER BY timestamp DESC
          LIMIT 1
        `,
        values
      );
    });

    const row = result.rows[0];
    if (row?.id) {
      return {
        id: row.id,
        tenantId: row.tenantId,
        eventName: row.eventName,
        eventId: row.eventId,
        schemaVersion: row.schemaVersion,
        source: row.source,
        ingestionPath: null,
        componentId: row.componentId,
        ctaId: row.ctaId,
        timestamp: row.timestamp.toISOString(),
        createdAt: row.timestamp.toISOString()
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for analytics event ${eventName}`);
}

export async function waitForLatestAnalyticsFactBySourceEventId(
  sourceEventId: string,
  timeoutMs = 20_000
): Promise<AnalyticsFactSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        id: string;
        tenantId: string;
        eventName: string;
        eventId: string | null;
        schemaVersion: number;
        ingestionSource: string;
        ingestionPath: string | null;
        componentId: string | null;
        ctaId: string | null;
        sourceEventId: string;
        eventTimestamp: Date;
        createdAt: Date;
      }>(
        `
          SELECT
            id,
            tenant_id AS "tenantId",
            event_name AS "eventName",
            event_id AS "eventId",
            schema_version AS "schemaVersion",
            ingestion_source AS "ingestionSource",
            ingestion_path AS "ingestionPath",
            component_id AS "componentId",
            cta_id AS "ctaId",
            source_event_id AS "sourceEventId",
            event_timestamp AS "eventTimestamp",
            created_at AS "createdAt"
          FROM event_facts
          WHERE source_event_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [sourceEventId]
      )
    );

    const row = result.rows[0];
    if (row?.id) {
      return {
        id: row.id,
        tenantId: row.tenantId,
        eventName: row.eventName,
        eventId: row.eventId,
        schemaVersion: row.schemaVersion,
        ingestionSource: row.ingestionSource,
        ingestionPath: row.ingestionPath,
        componentId: row.componentId,
        ctaId: row.ctaId,
        sourceEventId: row.sourceEventId,
        eventTimestamp: row.eventTimestamp.toISOString(),
        createdAt: row.createdAt.toISOString()
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for analytics fact ${sourceEventId}`);
}

export async function waitForLatestAnalyticsFactByEventName(
  eventName: string,
  timeoutMs = 20_000,
  filters?: { tenantId?: string; ctaId?: string; componentId?: string }
): Promise<AnalyticsFactSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) => {
      const conditions = ['event_name = $1'];
      const values: Array<string> = [eventName];

      if (filters?.tenantId) {
        conditions.push(`tenant_id = $${values.length + 1}`);
        values.push(filters.tenantId);
      }

      if (filters?.ctaId) {
        conditions.push(`cta_id = $${values.length + 1}`);
        values.push(filters.ctaId);
      }

      if (filters?.componentId) {
        conditions.push(`component_id = $${values.length + 1}`);
        values.push(filters.componentId);
      }

      return client.query<{
        id: string;
        tenantId: string;
        eventName: string;
        eventId: string | null;
        schemaVersion: number;
        ingestionSource: string;
        ingestionPath: string | null;
        componentId: string | null;
        ctaId: string | null;
        sourceEventId: string;
        eventTimestamp: Date;
        createdAt: Date;
      }>(
        `
          SELECT
            id,
            tenant_id AS "tenantId",
            event_name AS "eventName",
            event_id AS "eventId",
            schema_version AS "schemaVersion",
            ingestion_source AS "ingestionSource",
            ingestion_path AS "ingestionPath",
            component_id AS "componentId",
            cta_id AS "ctaId",
            source_event_id AS "sourceEventId",
            event_timestamp AS "eventTimestamp",
            created_at AS "createdAt"
          FROM event_facts
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT 1
        `,
        values
      );
    });

    const row = result.rows[0];
    if (row?.id) {
      return {
        id: row.id,
        tenantId: row.tenantId,
        eventName: row.eventName,
        eventId: row.eventId,
        schemaVersion: row.schemaVersion,
        ingestionSource: row.ingestionSource,
        ingestionPath: row.ingestionPath,
        componentId: row.componentId,
        ctaId: row.ctaId,
        sourceEventId: row.sourceEventId,
        eventTimestamp: row.eventTimestamp.toISOString(),
        createdAt: row.createdAt.toISOString()
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for analytics fact ${eventName}`);
}

export async function waitForLatestAnalyticsComparisonByEventId(
  eventId: string,
  timeoutMs = 20_000
): Promise<AnalyticsComparisonSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        id: string;
        tenantId: string;
        eventId: string;
        eventName: string;
        existsInDirect: boolean;
        existsInGa: boolean;
        payloadMatch: boolean;
        timeDiffMs: number | null;
        status: string;
        directSource: string | null;
        gaSource: string | null;
        comparisonDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>(
        `
          SELECT
            id,
            tenant_id AS "tenantId",
            event_id AS "eventId",
            event_name AS "eventName",
            exists_in_direct AS "existsInDirect",
            exists_in_ga AS "existsInGa",
            payload_match AS "payloadMatch",
            time_diff_ms AS "timeDiffMs",
            status,
            direct_source AS "directSource",
            ga_source AS "gaSource",
            comparison_date AS "comparisonDate",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM analytics_event_comparisons
          WHERE event_id = $1
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [eventId]
      )
    );

    const row = result.rows[0];
    if (row?.id) {
      return {
        id: row.id,
        tenantId: row.tenantId,
        eventId: row.eventId,
        eventName: row.eventName,
        existsInDirect: row.existsInDirect,
        existsInGa: row.existsInGa,
        payloadMatch: row.payloadMatch,
        timeDiffMs: row.timeDiffMs,
        status: row.status,
        directSource: row.directSource,
        gaSource: row.gaSource,
        comparisonDate: row.comparisonDate?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for analytics comparison ${eventId}`);
}

export async function getLatestTimelineEventsForOrder(
  orderUuid: string,
  limit = 10
): Promise<OrderTimelineEventSnapshot[]> {
  const result = await withClient(async (client) =>
    client.query<{
      type: string;
      currency: string | null;
      amount: string | null;
      paymentMethod: string | null;
      statusFrom: string | null;
      statusTo: string | null;
    }>(
      `
        SELECT
          e.type,
          e.currency,
          e.amount::text AS amount,
          e."paymentMethod",
          e."statusFrom",
          e."statusTo"
        FROM "OrderTimelineEvent" e
        INNER JOIN "Order" o ON o.id = e."orderId"
        WHERE o.uuid = $1
        ORDER BY e.timestamp DESC, e.id DESC
        LIMIT $2
      `,
      [orderUuid, limit]
    )
  );

  return result.rows.map((row) => ({
    type: row.type,
    currency: row.currency,
    amount: row.amount !== null ? Number(row.amount) : null,
    paymentMethod: row.paymentMethod,
    statusFrom: row.statusFrom,
    statusTo: row.statusTo
  }));
}

export async function waitForLatestConversationOutboundBySubject(
  subject: string,
  channel: "email" | "whatsapp" | "facebook" | "instagram",
  timeoutMs = 20_000
): Promise<ConversationOutboundSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        conversationId: string;
        inboxAccountId: string | null;
        remoteId: string | null;
        metadata: unknown;
        messageMetadata: unknown;
      }>(
        `
          SELECT
            c.id AS "conversationId",
            c."inboxAccountId" AS "inboxAccountId",
            im."remoteId" AS "remoteId",
            im.metadata AS metadata,
            cm.metadata AS "messageMetadata"
          FROM "Conversation" c
          INNER JOIN "ConversationMessage" cm ON cm."conversationId" = c.id
          LEFT JOIN "InboxMessage" im ON im.id = cm."inboxMessageId"
          WHERE c.subject = $1
            AND c.channel = $2::"ConversationChannel"
            AND cm."authorType" IN ('OPERATOR', 'AGENT')
          ORDER BY cm."createdAt" DESC
          LIMIT 1
        `,
        [subject, channel.toLowerCase()]
      )
    );

    const row = result.rows[0];
    if (row?.conversationId) {
      const inboxMetadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const messageMetadata =
        row.messageMetadata &&
        typeof row.messageMetadata === "object" &&
        !Array.isArray(row.messageMetadata)
          ? (row.messageMetadata as Record<string, unknown>)
          : null;
      const metadata = inboxMetadata ?? messageMetadata;

      return {
        conversationId: row.conversationId,
        inboxAccountId: row.inboxAccountId,
        remoteId: row.remoteId,
        providerMessageId:
          typeof metadata?.providerMessageId === "string"
            ? metadata.providerMessageId
            : null,
        deliveryStatus:
          typeof metadata?.deliveryStatus === "string"
            ? metadata.deliveryStatus
            : null,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for outbound message for subject ${subject}`);
}

export async function seedKnowledgeConversationMessage(
  subject: string,
  messageText: string,
  input?: {
    tenantKey?: string;
    channel?: "WEBCHAT" | "EMAIL" | "WHATSAPP" | "FACEBOOK" | "INSTAGRAM" | "ADMIN_CHAT";
    scope?: "CUSTOMER_PUBLIC" | "CUSTOMER_AUTHENTICATED" | "ADMIN_INTERNAL";
    authorType?: "CUSTOMER" | "OPERATOR" | "AGENT" | "SYSTEM";
  },
): Promise<SeededConversationMessageSnapshot> {
  const tenantKey = input?.tenantKey ?? "urucortinas";
  const channel = input?.channel ?? "WEBCHAT";
  const scope = input?.scope ?? "CUSTOMER_PUBLIC";
  const authorType = input?.authorType ?? "CUSTOMER";
  const conversationId = `c_${randomUUID().replace(/-/g, "")}`;
  const messageId = `m_${randomUUID().replace(/-/g, "")}`;
  const rawEventId = `re_${randomUUID().replace(/-/g, "")}`;
  const candidateId = `kc_${randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  const normalizedMessage = messageText.trim();
  const contextSummary = `Asunto: ${subject} · Scope: ${scope} · Canal: ${channel}`;
  const suggestedResponse = `Quedo revisando ${subject}.`;
  const relationSeed = `seed-${conversationId}`;
  const metadata = JSON.stringify({
    source: "qa-seed",
    subject,
  });

  await withClient(async (client) => {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO "Conversation" (
          id,
          "tenantKey",
          scope,
          "conversationRole",
          channel,
          status,
          "controlMode",
          "needsHuman",
          subject,
          "externalThreadId",
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3::"ConversationScope", $4::"ConversationRole", $5::"ConversationChannel", 'OPEN'::"ConversationStatus", 'AI'::"ConversationControlMode", false, $6, $7, $8, $8)
      `,
      [
        conversationId,
        tenantKey,
        scope,
        scope,
        channel,
        subject,
        `seed-${subject}-${Date.now()}`,
        now,
      ],
    );

    await client.query(
      `
        INSERT INTO "ConversationMessage" (
          id,
          "conversationId",
          "authorType",
          "kind",
          body,
          "normalizedText",
          "createdAt"
        ) VALUES ($1, $2, $3::"ConversationMessageAuthorType", 'TEXT'::"ConversationMessageKind", $4, $4, $5)
      `,
      [messageId, conversationId, authorType, messageText, now],
    );

    await client.query(
      `
        INSERT INTO "KnowledgeRawEvent" (
          id,
          "tenantKey",
          scope,
          channel,
          "sourceAuthorType",
          status,
          "conversationId",
          "messageId",
          "userMessage",
          "normalizedMessage",
          "redactedMessage",
          "operatorReply",
          "aiReply",
          "detectedIntent",
          problem,
          "contextSummary",
          "suggestedResponse",
          confidence,
          "relevanceScore",
          "dedupeHash",
          "clusterKey",
          "messageElements",
          "messageContextOrigin",
          attachments,
          metadata,
          "createdAt",
          "updatedAt"
        ) VALUES (
          $1,
          $2,
          $3::"KnowledgeDocumentScope",
          $4::"ConversationChannel",
          $5::"ConversationMessageAuthorType",
          'NEW'::"KnowledgeRawEventStatus",
          $6,
          $7,
          $8,
          $9,
          NULL,
          NULL,
          NULL,
          'order.status',
          'Seguimiento de pedido',
          $10,
          $11,
          0.92,
          0.88,
          $12,
          $12,
          NULL,
          NULL,
          NULL,
          $13::jsonb,
          $14,
          $14
        )
      `,
      [
        rawEventId,
        tenantKey,
        scope,
        channel,
        authorType,
        conversationId,
        messageId,
        normalizedMessage,
        normalizedMessage,
        contextSummary,
        suggestedResponse,
        relationSeed,
        metadata,
        now,
      ],
    );

    await client.query(
      `
        INSERT INTO "KnowledgeCandidate" (
          id,
          "tenantKey",
          scope,
          "sourceType",
          status,
          "observationId",
          title,
          excerpt,
          "redactedExcerpt",
          summary,
          "detectedIntent",
          problem,
          "contextSummary",
          "suggestedResponse",
          "approvedResponse",
          confidence,
          "dedupeHash",
          "clusterKey",
          version,
          "piiDetected",
          metadata,
          "conversationId",
          "messageId",
          "createdByUserId",
          "reviewedByUserId",
          "reviewedAt",
          "createdAt",
          "updatedAt"
        ) VALUES (
          $1,
          $2,
          $3::"KnowledgeDocumentScope",
          'CONVERSATION_DERIVED'::"KnowledgeSourceType",
          'PENDING'::"KnowledgeCandidateStatus",
          $4,
          $5,
          $6,
          NULL,
          $7,
          'order.status',
          'Seguimiento de pedido',
          $8,
          $9,
          NULL,
          0.92,
          $10,
          $10,
          1,
          false,
          $11::jsonb,
          $12,
          $13,
          NULL,
          NULL,
          NULL,
          $14,
          $14
        )
      `,
      [
        candidateId,
        tenantKey,
        scope,
        rawEventId,
        `Candidate ${subject}`,
        normalizedMessage,
        subject,
        `Asunto: ${subject} · Scope: ${scope} · Canal: ${channel}`,
        suggestedResponse,
        relationSeed,
        metadata,
        conversationId,
        messageId,
        now,
      ],
    );

    await client.query("COMMIT");
  });

  return { conversationId, messageId, rawEventId, candidateId };
}

export async function waitForLatestConversationReplyBySubjectInAiPlatform(
  subject: string,
  channel: "email" | "whatsapp" | "facebook" | "instagram",
  timeoutMs = 20_000
): Promise<ConversationOutboundSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(
      async (client) =>
        client.query<{
          conversationId: string;
          messageId: string;
          metadata: unknown;
        }>(
          `
          WITH target_conversation AS (
            SELECT
              cmr."conversationId"
            FROM "ChannelMessageRecord" cmr
            WHERE cmr.channel = $2::text
              AND cmr.direction = 'inbound'
              AND (
                cmr.metadata ->> 'subject' = $1
                OR cmr.metadata ->> 'fromName' = $1
                OR cmr.metadata -> 'metadata' ->> 'fromName' = $1
              )
            ORDER BY cmr."createdAt" DESC
            LIMIT 1
          )
          SELECT
            c.id AS "conversationId",
            m.id AS "messageId",
            m.metadata AS metadata
          FROM "Conversation" c
          INNER JOIN target_conversation tc ON tc."conversationId" = c.id
          INNER JOIN "Message" m ON m."conversationId" = c.id
          WHERE m.role = 'ASSISTANT'
          ORDER BY m."createdAt" DESC
          LIMIT 1
          `,
          [subject, channel.toLowerCase()],
        ),
      aiPlatformDatabaseUrl,
    );

    const row = result.rows[0];
    if (row?.conversationId) {
      const inboxMetadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;

      return {
        conversationId: row.conversationId,
        inboxAccountId: null,
        remoteId: row.messageId,
        providerMessageId:
          typeof inboxMetadata?.providerMessageId === "string"
            ? inboxMetadata.providerMessageId
            : null,
        deliveryStatus:
          typeof inboxMetadata?.deliveryStatus === "string"
            ? inboxMetadata.deliveryStatus
            : null,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for outbound message for subject ${subject}`);
}

export async function waitForConversationByThread(
  threadId: string,
  timeoutMs = 20_000
): Promise<{
  conversationId: string;
  channel: string;
  inboxAccountId: string | null;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        conversationId: string;
        channel: string;
        inboxAccountId: string | null;
      }>(
        `
          SELECT
            c.id AS "conversationId",
            c.channel AS "channel",
            c."inboxAccountId" AS "inboxAccountId"
          FROM "Conversation" c
          INNER JOIN "ChannelConversationBinding" cb ON cb."conversationId" = c.id
          WHERE cb."threadId" = $1
          ORDER BY c."updatedAt" DESC, c.id DESC
          LIMIT 1
        `,
        [threadId]
      )
    );

    const row = result.rows[0];
    if (row?.conversationId) {
      return {
        conversationId: row.conversationId,
        channel: row.channel,
        inboxAccountId: row.inboxAccountId
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for conversation for thread ${threadId}`);
}

export async function waitForLatestConversationOutboundByConversationId(
  conversationId: string,
  timeoutMs = 20_000
): Promise<ConversationOutboundSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        conversationId: string;
        inboxAccountId: string | null;
        remoteId: string | null;
        metadata: unknown;
        messageMetadata: unknown;
      }>(
        `
          SELECT
            c.id AS "conversationId",
            c."inboxAccountId" AS "inboxAccountId",
            im."remoteId" AS "remoteId",
            im.metadata AS metadata,
            cm.metadata AS "messageMetadata"
          FROM "Conversation" c
          INNER JOIN "ConversationMessage" cm ON cm."conversationId" = c.id
          LEFT JOIN "InboxMessage" im ON im.id = cm."inboxMessageId"
          WHERE c.id = $1
            AND cm."authorType" IN ('OPERATOR', 'AGENT')
          ORDER BY cm."createdAt" DESC
          LIMIT 1
        `,
        [conversationId]
      )
    );

    const row = result.rows[0];
    if (row?.conversationId) {
      const inboxMetadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const messageMetadata =
        row.messageMetadata &&
        typeof row.messageMetadata === "object" &&
        !Array.isArray(row.messageMetadata)
          ? (row.messageMetadata as Record<string, unknown>)
          : null;
      const metadata = inboxMetadata ?? messageMetadata;

      return {
        conversationId: row.conversationId,
        inboxAccountId: row.inboxAccountId,
        remoteId: row.remoteId,
        providerMessageId:
          typeof metadata?.providerMessageId === "string"
            ? metadata.providerMessageId
            : null,
        deliveryStatus:
          typeof metadata?.deliveryStatus === "string"
            ? metadata.deliveryStatus
            : null,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for outbound message for conversation ${conversationId}`);
}

export async function waitForLatestConversationOutboundByThread(
  threadId: string,
  channel: string,
  timeoutMs = 20_000
): Promise<ConversationOutboundSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await withClient(async (client) =>
      client.query<{
        conversationId: string;
        inboxAccountId: string | null;
        remoteId: string | null;
        metadata: unknown;
        messageMetadata: unknown;
      }>(
        `
          SELECT
            c.id AS "conversationId",
            c."inboxAccountId" AS "inboxAccountId",
            im."remoteId" AS "remoteId",
            im.metadata AS metadata,
            cm.metadata AS "messageMetadata"
          FROM "Conversation" c
          INNER JOIN "ChannelConversationBinding" cb ON cb."conversationId" = c.id
          INNER JOIN "ConversationMessage" cm ON cm."conversationId" = c.id
          LEFT JOIN "InboxMessage" im ON im.id = cm."inboxMessageId"
          WHERE cb."threadId" = $1
            AND cm."authorType" IN ('OPERATOR', 'AGENT')
          ORDER BY cm."createdAt" DESC
          LIMIT 1
        `,
        [threadId]
      )
    );

    const row = result.rows[0];
    if (row?.conversationId) {
      const inboxMetadata =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const messageMetadata =
        row.messageMetadata &&
        typeof row.messageMetadata === "object" &&
        !Array.isArray(row.messageMetadata)
          ? (row.messageMetadata as Record<string, unknown>)
          : null;
      const metadata = inboxMetadata ?? messageMetadata;

      return {
        conversationId: row.conversationId,
        inboxAccountId: row.inboxAccountId,
        remoteId: row.remoteId,
        providerMessageId:
          typeof metadata?.providerMessageId === "string"
            ? metadata.providerMessageId
            : null,
        deliveryStatus:
          typeof metadata?.deliveryStatus === "string"
            ? metadata.deliveryStatus
            : null,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for outbound message for thread ${threadId}`);
}

export async function getOrderSnapshotByUuid(orderUuid: string): Promise<LatestOrderSnapshot | null> {
  const result = await withClient(async (client) =>
    client.query<{
      uuid: string;
      orderCurrency: string;
      grandTotal: string;
      statusId: number;
      itemNames: string[] | null;
      itemCount: string;
    }>(
      `
        SELECT
          o.uuid,
          o."orderCurrency",
          o."grandTotal"::text AS "grandTotal",
          o."statusId",
          ARRAY(
            SELECT oi.name
            FROM "OrderItem" oi
            WHERE oi."orderId" = o.id
            ORDER BY oi.id ASC
          ) AS "itemNames",
          (
            SELECT COUNT(*)
            FROM "OrderItem" oi
            WHERE oi."orderId" = o.id
          )::text AS "itemCount"
        FROM "Order" o
        WHERE o.uuid = $1
        LIMIT 1
      `,
      [orderUuid]
    )
  );

  const row = result.rows[0];
  if (!row?.uuid) {
    return null;
  }

  return {
    uuid: row.uuid,
    orderCurrency: row.orderCurrency,
    grandTotal: Number(row.grandTotal),
    statusId: row.statusId,
    itemNames: row.itemNames ?? [],
    itemCount: Number(row.itemCount)
  };
}

export async function getConversationMessageById(
  messageId: string
): Promise<{
  id: string;
  body: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const result = await withClient(async (client) =>
    client.query<{
      id: string;
      body: string;
      metadata: unknown;
    }>(
      `
        SELECT
          m.id,
          m.body,
          m.metadata
        FROM "ConversationMessage" m
        WHERE m.id = $1
        LIMIT 1
      `,
      [messageId]
    )
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    body: row.body,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null
  };
}

export async function getAiPlatformChannelMessageRecordByRemoteId(
  remoteId: string
): Promise<{
  id: string;
  conversationId: string;
  status: string | null;
  metadata: Record<string, unknown> | null;
} | null> {
  const result = await withClient(async (client) =>
    client.query<{
      id: string;
      conversationId: string;
      status: string | null;
      metadata: unknown;
    }>(
      `
        SELECT
          cmr.id,
          cmr."conversationId",
          cmr.status,
          cmr.metadata
        FROM "ChannelMessageRecord" cmr
        WHERE cmr."remoteId" = $1
        ORDER BY cmr."createdAt" DESC
        LIMIT 1
      `,
      [remoteId],
      ),
    aiPlatformDatabaseUrl,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    conversationId: row.conversationId,
    status: row.status,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
  };
}

export async function getAiPlatformMessageById(
  messageId: string
): Promise<{
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const result = await withClient(
    async (client) =>
      client.query<{
        id: string;
        conversationId: string;
        role: string;
        content: string;
        metadata: unknown;
      }>(
        `
          SELECT
            m.id,
            m."conversationId",
            m.role,
            m.content,
            m.metadata
          FROM "Message" m
          WHERE m.id = $1
          LIMIT 1
        `,
        [messageId]
      ),
    aiPlatformDatabaseUrl,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
}

export async function getNotificationsForOrder(orderUuid: string): Promise<OrderNotificationSnapshot[]> {
  const result = await withClient(async (client) =>
    client.query<{
      eventType: string | null;
      audience: string | null;
      channel: string | null;
      title: string | null;
      body: string | null;
    }>(
      `
        SELECT
          n."eventType",
          n.audience,
          n.channel,
          n.title,
          n.body
        FROM "Notification" n
        INNER JOIN "Order" o ON o.id = n."orderId"
        WHERE o.uuid = $1
        ORDER BY n.id ASC
      `,
      [orderUuid]
    )
  );

  return result.rows.map((row) => ({
    eventType: row.eventType,
    audience: row.audience,
    channel: row.channel,
    title: row.title,
    body: row.body
  }));
}

export async function getEmailLogsForOrder(orderUuid: string): Promise<OrderEmailLogSnapshot[]> {
  const result = await withClient(async (client) =>
    client.query<{
      category: string;
      recipientType: string;
      toAddress: string;
      subject: string;
      status: string;
    }>(
      `
        SELECT
          e.category::text AS category,
          e."recipientType"::text AS "recipientType",
          e."toAddress",
          e.subject,
          e.status::text AS status
        FROM "EmailLog" e
        WHERE e.payload ->> 'orderNumber' = $1
        ORDER BY e.id ASC
      `,
      [orderUuid]
    )
  );

  return result.rows.map((row) => ({
    category: row.category,
    recipientType: row.recipientType,
    toAddress: row.toAddress,
    subject: row.subject,
    status: row.status
  }));
}

export async function markLatestMercadoPagoIntentApproved(
  checkoutToken: string
): Promise<ApprovedMercadoPagoIntentSnapshot> {
  const externalPaymentId = `mp-e2e-${Date.now()}`;
  const result = await withClient(async (client) =>
    client.query<{ id: string; externalPaymentId: string }>(
      `
        UPDATE "StorefrontPaymentIntent"
        SET
          "externalPaymentId" = $2,
          status = 'approved',
          "statusDetail" = 'accredited',
          "updatedAt" = now(),
          "statusUpdatedAt" = now()
        WHERE id = (
          SELECT id
          FROM "StorefrontPaymentIntent"
          WHERE provider = 'mercadopago'
            AND metadata ->> 'checkoutToken' = $1
          ORDER BY "createdAt" DESC
          LIMIT 1
        )
        RETURNING id, "externalPaymentId"
      `,
      [checkoutToken, externalPaymentId]
    )
  );

  const row = result.rows[0];
  if (!row?.id || !row.externalPaymentId) {
    throw new Error(`No Mercado Pago intent found for checkout token ${checkoutToken}`);
  }

  return row;
}

export async function getCustomerAddressesByEmail(email: string): Promise<CustomerAddressSnapshot[]> {
  const result = await withClient(async (client) =>
    client.query<{
      id: number;
      isPrimary: boolean;
      street: string;
      number: string;
      apartment: string | null;
      corner: string | null;
      city: string;
      department: string | null;
      neighborhood: string | null;
      country: string;
    }>(
      `
        SELECT
          a.id,
          a."isPrimary",
          a.street,
          a.number,
          a.apartment,
          a.corner,
          a.city,
          a.department,
          a.neighborhood,
          a.country
        FROM "CustomerAddress" a
        INNER JOIN "Customer" c ON c.id = a."customerId"
        WHERE c.email = $1
        ORDER BY a.id ASC
      `,
      [email]
    )
  );

  return result.rows.map((row) => ({
    id: row.id,
    isPrimary: row.isPrimary,
    line1: `${row.street ?? ""} ${row.number ?? ""}`.trim(),
    line2: [row.apartment, row.corner].filter(Boolean).join(", ") || null,
    city: row.city,
    department: row.department,
    neighborhood: row.neighborhood,
    country: row.country
  }));
}

export async function getOrderAddressByUuid(orderUuid: string): Promise<OrderAddressSnapshot | null> {
  const result = await withClient(async (client) =>
    client.query<{
      shippingCity: string | null;
      shippingDepartment: string | null;
      shippingNeighborhood: string | null;
      shippingCountry: string | null;
    }>(
      `
        SELECT
          o."shippingCity",
          o."shippingDepartment",
          o."shippingNeighborhood",
          o."shippingCountry"
        FROM "Order" o
        WHERE o.uuid = $1
        LIMIT 1
      `,
      [orderUuid]
    )
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    shippingCity: row.shippingCity,
    shippingDepartment: row.shippingDepartment,
    shippingNeighborhood: row.shippingNeighborhood,
    shippingCountry: row.shippingCountry
  };
}
