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
  const response = await request.post(`${adminApiBaseUrl}/sign-in`, {
    data: {
      email: adminEmail,
      password: adminPassword
    }
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as SignInResponse;
  const token = resolveAuthToken(payload);
  expect(token).toBeTruthy();
  return token as string;
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
