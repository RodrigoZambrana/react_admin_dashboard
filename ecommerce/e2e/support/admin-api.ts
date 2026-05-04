import { expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

import {
  aiPlatformApiBaseUrl,
  aiPlatformInternalToken,
} from "./env";

const adminApiBaseUrl = process.env.PLAYWRIGHT_ADMIN_API_URL ?? "http://127.0.0.1:4000/api";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "desarrollo@software-strategy.com";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "Pass123";
const aiPlatformConversationChannel = "email";

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
  conversationId: string;
};

type InboxAccountPayload = {
  id: string;
  channel?: string;
  address?: string | null;
  displayName?: string | null;
  active?: boolean;
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
  const tenantKey = input.tenantKey ?? "urucortinas";
  const threadId = `admin-internal-${Date.now()}-${randomUUID()}`;
  const userId = credentials.email;

  const bootstrapResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/bootstrap-thread`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        tenantKey,
        channel: aiPlatformConversationChannel,
        userId,
        threadId,
        displayName: input.subject,
        email: credentials.email,
        inboxAddress: credentials.email,
        metadata: {
          subject: input.subject,
          seedKind: "admin_internal_session",
        },
      },
    },
  );

  expect(bootstrapResponse.ok()).toBeTruthy();
  const bootstrapPayload = (await bootstrapResponse.json()) as AdminConversationPayload & {
    id?: string;
    conversationId?: string;
  };
  const conversationId = bootstrapPayload.conversationId ?? bootstrapPayload.id;
  if (!conversationId) {
    throw new Error("bootstrap-thread did not return a conversation id");
  }

  const inboundResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/inbound`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        tenantKey,
        channel: aiPlatformConversationChannel,
        userId,
        conversationId,
        threadId,
        displayName: input.subject,
        email: credentials.email,
        subject: input.subject,
        text: input.message,
        authorKind: "customer_human",
        messageKind: "text",
        direction: "inbound",
        metadata: {
          subject: input.subject,
          seedKind: "admin_internal_session",
        },
      },
    },
  );

  expect(inboundResponse.ok()).toBeTruthy();

  const turnResponse = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/${conversationId}/agent-turn`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        message: input.message,
      },
    },
  );

  expect(turnResponse.ok()).toBeTruthy();
  const turnPayload = (await turnResponse.json()) as {
    response?: {
      text?: string;
      finalUserText?: string;
    };
  };
  const replyText =
    turnPayload.response?.text?.trim() ||
    turnPayload.response?.finalUserText?.trim() ||
    "";

  if (replyText) {
    const replyResponse = await request.post(
      `${aiPlatformApiBaseUrl}/internal/conversations/${conversationId}/replies/agent`,
      {
        headers: {
          "x-ai-internal-token": aiPlatformInternalToken,
        },
        data: {
          body: replyText,
          finalUserText: replyText,
          debugSummary: null,
          metadata: {
            seedKind: "admin_internal_session",
            subject: input.subject,
          },
        },
      },
    );

    expect(replyResponse.ok()).toBeTruthy();
  }

  // The admin token is resolved above so the helper still exercises the auth path.
  expect(token).toBeTruthy();
  return {
    ...bootstrapPayload,
    conversationId,
    id: bootstrapPayload.id ?? conversationId,
  } as AdminConversationPayload;
}

export async function startAdminInternalAssistantConversationForUser(
  request: APIRequestContext,
  credentials: { email: string; password: string },
  input?: { tenantKey?: string }
): Promise<AdminConversationPayload> {
  const token = await signInAdminUser(request, credentials);
  const tenantKey = input?.tenantKey ?? "urucortinas";
  const threadId = `admin-internal-assistant-${Date.now()}-${randomUUID()}`;

  const response = await request.post(
    `${aiPlatformApiBaseUrl}/internal/conversations/bootstrap-thread`,
    {
      headers: {
        "x-ai-internal-token": aiPlatformInternalToken,
      },
      data: {
        tenantKey,
        channel: aiPlatformConversationChannel,
        userId: credentials.email,
        threadId,
        displayName: "Asistente interno",
        email: credentials.email,
        inboxAddress: credentials.email,
        metadata: {
          seedKind: "admin_internal_assistant",
        },
      },
    },
  );

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as AdminConversationPayload;
  expect(payload.id).toBeTruthy();
  expect(token).toBeTruthy();
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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/session`,
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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/messages`,
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

  const directMessageId = messagePayload.message?.id ?? null;
  if (directMessageId) {
    return {
      ...sessionPayload,
      messageId: directMessageId,
    };
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const transcriptResponse = await request.get(
      `${aiPlatformApiBaseUrl}/chat/public/webchat/session/${sessionPayload.conversationId}?guestId=${encodeURIComponent(
        sessionPayload.guestId ?? input.guestId,
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

    if (customerMessage?.id) {
      return {
        ...sessionPayload,
        messageId: customerMessage.id,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return {
    ...sessionPayload,
    messageId: null,
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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/session`,
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
    `${aiPlatformApiBaseUrl}/chat/public/webchat/messages`,
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

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const transcriptResponse = await request.get(
      `${aiPlatformApiBaseUrl}/chat/public/webchat/session/${sessionPayload.conversationId}?guestId=${encodeURIComponent(
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

    if (customerMessage?.id) {
      return {
        conversationId: transcript.conversationId,
        guestId: effectiveGuestId,
        messageId: customerMessage.id,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  return {
    conversationId: sessionPayload.conversationId,
    guestId: effectiveGuestId,
    messageId: null,
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

export async function getOperationalEmailInboxAccountId(
  request: APIRequestContext,
): Promise<string> {
  const token = await signInAdmin(request);
  const response = await request.get(`${adminApiBaseUrl}/inbox/accounts`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    params: {
      channel: "EMAIL",
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as InboxAccountPayload[];
  const account = payload.find(
    (entry) => entry.channel === "EMAIL" && typeof entry.id === "string" && entry.id.length > 0,
  );

  expect(account?.id).toBeTruthy();
  return account!.id;
}
