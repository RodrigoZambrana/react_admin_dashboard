import { Client } from "pg";

import { databaseUrl, storefrontBaseUrl } from "./env";

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

export type ApprovedMercadoPagoIntentSnapshot = {
  id: string;
  externalPaymentId: string;
};

function normalizeActionUrl(url: string): string {
  const target = new URL(url);
  const storefront = new URL(storefrontBaseUrl);

  target.protocol = storefront.protocol;
  target.host = storefront.host;

  return target.toString();
}

async function withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });
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
