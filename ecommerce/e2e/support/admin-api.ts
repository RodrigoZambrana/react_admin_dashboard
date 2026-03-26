import { expect, type APIRequestContext } from "@playwright/test";

const adminApiBaseUrl = process.env.PLAYWRIGHT_ADMIN_API_URL ?? "http://localhost:4000/api";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "desarrollo@software-strategy.com";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "LocalAdmin123!";

type SignInResponse =
  | {
      token?: string;
      accessToken?: string;
      data?: {
        token?: string;
        accessToken?: string;
      };
    }
  | null
  | undefined;

const resolveAuthToken = (payload: SignInResponse): string | null => {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.token === "string" && payload.token.length > 0) {
    return payload.token;
  }
  if (typeof payload.accessToken === "string" && payload.accessToken.length > 0) {
    return payload.accessToken;
  }
  if (payload.data && typeof payload.data === "object") {
    if (typeof payload.data.token === "string" && payload.data.token.length > 0) {
      return payload.data.token;
    }
    if (typeof payload.data.accessToken === "string" && payload.data.accessToken.length > 0) {
      return payload.data.accessToken;
    }
  }
  return null;
};

export async function signInAdmin(request: APIRequestContext): Promise<string> {
  return signInAdminUser(request, {
    email: adminEmail,
    password: adminPassword,
  });
}

export async function signInAdminUser(
  request: APIRequestContext,
  credentials: { email: string; password: string }
): Promise<string> {
  const response = await request.post(`${adminApiBaseUrl}/sign-in`, {
    data: {
      email: credentials.email,
      password: credentials.password
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as SignInResponse;
  const token = resolveAuthToken(payload);
  expect(token).toBeTruthy();
  return token as string;
}

type ManagedAdminUserPayload = {
  name: string;
  lastName?: string;
  email: string;
  password: string;
  role?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  capabilityGroups?: string[];
  directCapabilities?: string[];
};

type ManagedAdminUserResponse = {
  id: number | string;
  email: string;
  role?: string;
  capabilityGroups?: string[];
  directCapabilities?: string[];
};

type AdminConversationPayload = {
  id: string;
};

export async function createManagedAdminUser(
  request: APIRequestContext,
  user: ManagedAdminUserPayload
): Promise<ManagedAdminUserResponse> {
  const token = await signInAdmin(request);
  const createResponse = await request.post(`${adminApiBaseUrl}/users`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    multipart: {
      name: user.name,
      lastName: user.lastName ?? "",
      email: user.email,
      role: user.role ?? "ADMIN",
      country: user.country ?? "Uruguay",
      countryCode: user.countryCode ?? "UY",
      city: user.city ?? "Montevideo",
      capabilityGroups: JSON.stringify(user.capabilityGroups ?? []),
      directCapabilities: JSON.stringify(user.directCapabilities ?? [])
    }
  });

  expect(createResponse.ok()).toBeTruthy();
  const created = (await createResponse.json()) as ManagedAdminUserResponse;
  expect(created.id).toBeTruthy();

  const passwordResponse = await request.put(
    `${adminApiBaseUrl}/users/${created.id}/password`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        password: user.password
      }
    }
  );

  expect(passwordResponse.ok()).toBeTruthy();
  return created;
}

export async function createAdminInternalSessionForUser(
  request: APIRequestContext,
  credentials: { email: string; password: string },
  input: { subject: string; message: string; tenantKey?: string }
): Promise<AdminConversationPayload> {
  const token = await signInAdminUser(request, credentials);
  const response = await request.post(
    `${adminApiBaseUrl}/conversations/admin-internal/session`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        subject: input.subject,
        message: input.message,
        tenantKey: input.tenantKey
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as AdminConversationPayload;
  expect(payload.id).toBeTruthy();
  return payload;
}

export async function startAdminInternalAssistantConversationForUser(
  request: APIRequestContext,
  credentials: { email: string; password: string },
  input?: { tenantKey?: string }
): Promise<AdminConversationPayload> {
  const token = await signInAdminUser(request, credentials);
  const response = await request.post(`${adminApiBaseUrl}/conversations/contact-session`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    data: {
      contactType: "internal",
      tenantKey: input?.tenantKey
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as AdminConversationPayload;
  expect(payload.id).toBeTruthy();
  return payload;
}

export async function updatePaymentStatus(
  request: APIRequestContext,
  paymentId: number,
  status: "REGISTERED" | "CONFIRMED" | "FAILED"
) {
  const token = await signInAdmin(request);
  const response = await request.put(`${adminApiBaseUrl}/accounting/payments/${paymentId}`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    data: {
      status
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}
