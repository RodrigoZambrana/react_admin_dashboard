import { Client } from "pg";

import { databaseUrl, storefrontBaseUrl } from "./env";

type EmailActionEvent = "verify_email" | "reset_link";

type EmailActionLink = {
  url: string;
  subject: string;
  locale: string;
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
