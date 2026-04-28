import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

import { buildTestCustomer } from "./support/factories";
import { storefrontApiBaseUrl } from "./support/env";

async function registerViaApi(request: APIRequestContext, payload: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}) {
  return request.post(`${storefrontApiBaseUrl}/auth/register`, {
    data: {
      ...payload,
      locale: "es",
    },
  });
}

function extractMessage(body: unknown): string {
  if (!body || typeof body !== "object") {
    return String(body ?? "");
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map((entry) => String(entry)).join(" ");
  }
  return JSON.stringify(body);
}

test.describe("storefront register duplicate coverage", () => {
  test("rejects registering a customer with an existing email", async ({ request }) => {
    const existing = buildTestCustomer(Date.now());
    const first = await registerViaApi(request, existing);
    expect(first.ok()).toBeTruthy();

    const duplicatePhone = buildTestCustomer(Date.now() + 1);
    const second = await registerViaApi(request, {
      ...duplicatePhone,
      email: existing.email,
      phone: duplicatePhone.phone,
    });

    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(extractMessage(body)).toContain("Customer already exists");
  });

  test("rejects registering a customer with an existing phone", async ({ request }) => {
    const existing = buildTestCustomer(Date.now() + 10);
    const first = await registerViaApi(request, existing);
    expect(first.ok()).toBeTruthy();

    const duplicateEmail = buildTestCustomer(Date.now() + 11);
    const second = await registerViaApi(request, {
      ...duplicateEmail,
      email: duplicateEmail.email,
      phone: existing.phone,
    });

    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(extractMessage(body)).toContain("Customer already exists");
  });
});
