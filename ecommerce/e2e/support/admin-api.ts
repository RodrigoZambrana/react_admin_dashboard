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

type KnowledgeCandidatePayload = {
  id: string;
  status: string;
  excerpt: string;
  suggestedResponse?: string | null;
  approvedResponse?: string | null;
  detectedIntent?: string | null;
  confidence?: number | null;
  feedback?: {
    used: number;
    edited: number;
    discarded: number;
    total: number;
    applied: number;
    adoptionRate: number;
    discardRate: number;
  } | null;
};

type KnowledgeConversationBundlePayload = {
  id: string;
  status: string;
  title: string;
  summary?: string | null;
  previewQuestion?: string | null;
  previewResponse?: string | null;
};

type KnowledgeNegativeExamplePayload = {
  id: string;
  status: string;
  title: string;
  summary?: string | null;
  disallowedText: string;
};

type KnowledgeSnapshotPayload = {
  id: string;
  scope: string;
  version: number;
  summaryText?: string | null;
  entries: Array<{
    id: string;
    title: string;
    entryType: string;
  }>;
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

export async function listKnowledgeCandidates(
  request: APIRequestContext,
  input?: {
    tenantKey?: string;
    status?: "pending" | "approved" | "rejected";
    search?: string;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "asc" | "desc";
  }
): Promise<KnowledgeCandidatePayload[]> {
  const token = await signInAdmin(request);
  const params = new URLSearchParams();
  if (input?.tenantKey) {
    params.set("tenantKey", input.tenantKey);
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  if (input?.search) {
    params.set("search", input.search);
  }
  params.set("pageSize", String(input?.pageSize ?? 250));
  if (input?.orderBy) {
    params.set("orderBy", input.orderBy);
  }
  if (input?.orderDir) {
    params.set("orderDir", input.orderDir);
  }

  const query = params.toString();
  const response = await request.get(
    `${adminApiBaseUrl}/ai/knowledge/candidates${query ? `?${query}` : ""}`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items?: KnowledgeCandidatePayload[];
  };
  return payload.items ?? [];
}

export async function reviewKnowledgeCandidate(
  request: APIRequestContext,
  input: {
    candidateId: string;
    approved: boolean;
    content?: string;
    scope?: "customer_public" | "admin_internal";
    promoteToDocument?: boolean;
    title?: string;
    summary?: string;
  }
): Promise<KnowledgeCandidatePayload> {
  const token = await signInAdmin(request);
  const response = await request.post(
    `${adminApiBaseUrl}/ai/knowledge/candidates/${input.candidateId}/review`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        action: input.approved ? "approve" : "reject",
        content: input.content,
        scope: input.scope,
        promoteToDocument: input.promoteToDocument,
        title: input.title,
        summary: input.summary
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    candidate?: KnowledgeCandidatePayload;
  };
  return payload.candidate as KnowledgeCandidatePayload;
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

export async function createWebchatConversation(
  request: APIRequestContext,
  input: {
    guestId: string;
    name: string;
    email: string;
    text: string;
    authenticated?: boolean;
    attachments?: Array<{
      assetType?: string;
      fileName?: string;
      contentType?: string;
      textContent?: string;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  const sessionResponse = await request.post(
    `${adminApiBaseUrl}/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: input.guestId,
        name: input.name,
        email: input.email,
        locale: "es-UY",
        page: "/shop",
        authenticated: input.authenticated ?? false,
      },
    },
  );

  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as {
    conversationId: string;
    guestId?: string | null;
  };

  const messageResponse = await request.post(
    `${adminApiBaseUrl}/conversations/webchat/message`,
    {
      data: {
        conversationId: sessionPayload.conversationId,
        guestId: sessionPayload.guestId ?? input.guestId,
        text: input.text,
        attachments: input.attachments ?? [],
      },
    },
  );

  expect(messageResponse.ok()).toBeTruthy();
  const messagePayload = (await messageResponse.json()) as {
    message?: {
      id?: string;
    };
  };

  return {
    ...sessionPayload,
    messageId: messagePayload.message?.id ?? null,
  };
}

export async function dispatchWebchatConversation(
  request: APIRequestContext,
  input: {
    guestId: string;
    name: string;
    email: string;
    text: string;
    authenticated?: boolean;
    attachments?: Array<{
      assetType?: string;
      fileName?: string;
      contentType?: string;
      textContent?: string;
      metadata?: Record<string, unknown>;
    }>;
  },
) {
  const sessionResponse = await request.post(
    `${adminApiBaseUrl}/conversations/webchat/session`,
    {
      data: {
        tenantKey: "urucortinas",
        guestId: input.guestId,
        name: input.name,
        email: input.email,
        locale: "es-UY",
        page: "/shop",
        authenticated: input.authenticated ?? false,
      },
    },
  );

  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = (await sessionResponse.json()) as {
    conversationId: string;
    guestId?: string | null;
  };

  const effectiveGuestId = sessionPayload.guestId ?? input.guestId;
  const dispatchResponse = await request.post(
    `${adminApiBaseUrl}/conversations/webchat/dispatch`,
    {
      data: {
        tenantKey: "urucortinas",
        conversationId: sessionPayload.conversationId,
        guestId: effectiveGuestId,
        userId: effectiveGuestId,
        scope: input.authenticated ? "customer_authenticated" : "customer_public",
        text: input.text,
        attachments: input.attachments ?? [],
        metadata: {
          page: "/shop",
        },
      },
    },
  );

  expect(dispatchResponse.ok()).toBeTruthy();

  const transcriptResponse = await request.get(
    `${adminApiBaseUrl}/conversations/webchat/session/${sessionPayload.conversationId}?guestId=${encodeURIComponent(
      effectiveGuestId,
    )}`,
  );

  expect(transcriptResponse.ok()).toBeTruthy();
  const transcript = (await transcriptResponse.json()) as {
    conversationId: string;
    messages?: Array<{
      id: string;
      role: string;
      text?: string | null;
      createdAt?: string;
    }>;
  };

  const customerMessage = [...(transcript.messages ?? [])]
    .reverse()
    .find((message) => message.role === "customer" && (message.text ?? "").includes(input.text));

  return {
    conversationId: transcript.conversationId,
    guestId: effectiveGuestId,
    messageId: customerMessage?.id ?? null,
  };
}

export async function createKnowledgeCandidateFromConversation(
  request: APIRequestContext,
  input: {
    conversationId: string;
    messageId: string;
    tenantKey?: string;
    title?: string;
    summary?: string;
  },
) {
  const token = await signInAdmin(request);
  const response = await request.post(
    `${adminApiBaseUrl}/ai/knowledge/candidates/from-conversation`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        tenantKey: input.tenantKey ?? "urucortinas",
        conversationId: input.conversationId,
        messageId: input.messageId,
        title: input.title,
        summary: input.summary,
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function ingestConversationKnowledge(
  request: APIRequestContext,
  input?: {
    tenantKey?: string;
    limit?: number;
  }
) {
  const token = await signInAdmin(request);
  const response = await request.post(`${adminApiBaseUrl}/ai/knowledge/ingest/conversations`, {
    headers: {
      authorization: `Bearer ${token}`
    },
    data: {
      tenantKey: input?.tenantKey,
      limit: input?.limit ?? 100
    }
  });

  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function listConversationBundles(
  request: APIRequestContext,
  input?: {
    tenantKey?: string;
    scope?: "customer_public" | "admin_internal";
    status?: "pending" | "approved" | "rejected";
    search?: string;
    pageSize?: number;
  }
): Promise<KnowledgeConversationBundlePayload[]> {
  const token = await signInAdmin(request);
  const params = new URLSearchParams();
  if (input?.tenantKey) {
    params.set("tenantKey", input.tenantKey);
  }
  if (input?.scope) {
    params.set("scope", input.scope);
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  if (input?.search) {
    params.set("search", input.search);
  }
  params.set("pageSize", String(input?.pageSize ?? 100));

  const response = await request.get(
    `${adminApiBaseUrl}/ai/knowledge/conversation-bundles?${params.toString()}`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items?: KnowledgeConversationBundlePayload[];
  };
  return payload.items ?? [];
}

export async function reviewConversationBundle(
  request: APIRequestContext,
  input: {
    bundleId: string;
    action: "approve" | "reject";
    summary?: string;
  }
): Promise<KnowledgeConversationBundlePayload> {
  const token = await signInAdmin(request);
  const response = await request.post(
    `${adminApiBaseUrl}/ai/knowledge/conversation-bundles/${input.bundleId}/review`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        action: input.action,
        summary: input.summary
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeConversationBundlePayload;
}

export async function listNegativeExamples(
  request: APIRequestContext,
  input?: {
    tenantKey?: string;
    scope?: "customer_public" | "admin_internal";
    status?: "pending" | "approved" | "rejected";
    search?: string;
    pageSize?: number;
  }
): Promise<KnowledgeNegativeExamplePayload[]> {
  const token = await signInAdmin(request);
  const params = new URLSearchParams();
  if (input?.tenantKey) {
    params.set("tenantKey", input.tenantKey);
  }
  if (input?.scope) {
    params.set("scope", input.scope);
  }
  if (input?.status) {
    params.set("status", input.status);
  }
  if (input?.search) {
    params.set("search", input.search);
  }
  params.set("pageSize", String(input?.pageSize ?? 100));

  const response = await request.get(
    `${adminApiBaseUrl}/ai/knowledge/negative-examples?${params.toString()}`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items?: KnowledgeNegativeExamplePayload[];
  };
  return payload.items ?? [];
}

export async function reviewNegativeExample(
  request: APIRequestContext,
  input: {
    negativeExampleId: string;
    action: "approve" | "reject";
    title?: string;
    summary?: string;
    correctedText?: string;
  }
): Promise<KnowledgeNegativeExamplePayload> {
  const token = await signInAdmin(request);
  const response = await request.post(
    `${adminApiBaseUrl}/ai/knowledge/negative-examples/${input.negativeExampleId}/review`,
    {
      headers: {
        authorization: `Bearer ${token}`
      },
      data: {
        action: input.action,
        title: input.title,
        summary: input.summary,
        correctedText: input.correctedText
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeNegativeExamplePayload;
}

export async function getLatestKnowledgeSnapshot(
  request: APIRequestContext,
  input?: {
    tenantKey?: string;
    scope?: "customer_public" | "admin_internal";
  }
): Promise<KnowledgeSnapshotPayload> {
  const token = await signInAdmin(request);
  const params = new URLSearchParams();
  if (input?.tenantKey) {
    params.set("tenantKey", input.tenantKey);
  }
  if (input?.scope) {
    params.set("scope", input.scope);
  }

  const response = await request.get(
    `${adminApiBaseUrl}/ai/knowledge/snapshots/latest${params.toString() ? `?${params.toString()}` : ""}`,
    {
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );

  expect(response.ok()).toBeTruthy();
  return (await response.json()) as KnowledgeSnapshotPayload;
}
