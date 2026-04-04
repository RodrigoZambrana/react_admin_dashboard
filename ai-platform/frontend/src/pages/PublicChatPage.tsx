import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  acceptAsyncChatMessage,
  getAsyncChatSession,
  listAsyncChatConversations,
  reportAsyncChatTyping,
} from '../api';
import { TemplateAssetBundle } from '../components/layout/TemplateAssetBundle';
import {
  PublicChatShell,
  type PublicChatConversationListItem,
  type PublicChatTranscriptItem,
} from '../components/chat/PublicChatShell';
import type {
  AsyncChatAcceptedResponse,
  AsyncChatConversationSummary,
  AsyncChatSessionView,
  AsyncPresenceState,
} from '../types';

const ACTIVE_SESSION_POLL_MS = 1200;
const IDLE_SESSION_POLL_MS = 4000;
const RECENT_CONVERSATION_SYNC_MS = 6000;
const TYPING_HEARTBEAT_DEBOUNCE_MS = 250;

function buildConversationItems(
  conversations: AsyncChatConversationSummary[],
): PublicChatConversationListItem[] {
  return conversations.map((conversation) => ({
    conversationId: conversation.conversationId,
    title: 'AI Concierge',
    preview: conversation.latestPreview ?? '',
    timestamp: conversation.latestTimestamp,
    presence: conversation.presence,
    awaitingReply: conversation.awaitingReply,
    typingActive: conversation.typingActive,
    activeTurnId: conversation.activeTurnId,
  }));
}

function buildTranscript(
  session: AsyncChatSessionView | null,
): PublicChatTranscriptItem[] {
  if (!session) {
    return [];
  }

  const transcript: PublicChatTranscriptItem[] = session.messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));

  if (session.activeTurn?.internalStatus === 'STABILIZING') {
    transcript.push(
      ...session.activeTurn.inputs.map((input) => ({
        id: input.id,
        role: 'USER' as const,
        content: input.content,
        createdAt: input.receivedAt,
        pending: true,
      })),
    );
  }

  if (
    session.activeTurn &&
    (session.presence.state === 'processing' ||
      session.presence.state === 'awaiting_reply')
  ) {
    transcript.push({
      id: `presence-${session.activeTurn.id}`,
      role: 'ASSISTANT',
      content: '',
      createdAt:
        session.activeTurn.processingCompletedAt ??
        session.activeTurn.processingStartedAt ??
        session.activeTurn.acceptedAt,
      typing: true,
      stateLabel:
        session.presence.state === 'awaiting_reply' ? 'Typing' : 'Analyzing',
    });
  }

  return transcript;
}

function buildOptimisticSession(
  previous: AsyncChatSessionView | null,
  accepted: AsyncChatAcceptedResponse,
  locale: string | null,
): AsyncChatSessionView {
  const baseConversation = previous?.conversation ?? {
    id: accepted.conversationId,
    language: locale,
    channel: 'webchat_async',
    createdAt: accepted.presence.acceptedAt ?? new Date().toISOString(),
    updatedAt: accepted.presence.acceptedAt ?? new Date().toISOString(),
  };

  return {
    conversation: {
      ...baseConversation,
      id: accepted.conversationId,
      language: accepted.turn.locale ?? baseConversation.language,
      updatedAt: accepted.presence.acceptedAt ?? baseConversation.updatedAt,
    },
    presence: accepted.presence,
    activeTurn: accepted.turn,
    latestCompletedTurn:
      previous?.conversation.id === accepted.conversationId
        ? previous.latestCompletedTurn
        : null,
    turns:
      previous?.conversation.id === accepted.conversationId
        ? [accepted.turn, ...previous.turns.filter((turn) => turn.id !== accepted.turn.id)]
        : [accepted.turn],
    messages:
      previous?.conversation.id === accepted.conversationId ? previous.messages : [],
  };
}

function resolveConversationIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryConversationId = params.get('conversationId');

  return queryConversationId?.trim() || null;
}

function syncConversationIdToUrl(conversationId: string | null) {
  const nextUrl = new URL(window.location.href);

  if (conversationId) {
    nextUrl.searchParams.set('conversationId', conversationId);
  } else {
    nextUrl.searchParams.delete('conversationId');
  }

  window.history.replaceState({}, '', nextUrl);
}

function buildConversationSummaryFromSession(
  session: AsyncChatSessionView,
): AsyncChatConversationSummary {
  const latestPersistedMessage = session.messages.at(-1) ?? null;
  const latestPendingInput = session.activeTurn?.inputs.at(-1) ?? null;
  const latestPreview =
    (session.activeTurn?.internalStatus === 'STABILIZING'
      ? latestPendingInput?.content
      : null) ??
    latestPersistedMessage?.content ??
    session.activeTurn?.semanticInput ??
    null;
  const latestTimestamp =
    (session.activeTurn?.internalStatus === 'STABILIZING'
      ? latestPendingInput?.receivedAt
      : null) ??
    latestPersistedMessage?.createdAt ??
    session.presence.acceptedAt ??
    null;

  return {
    conversationId: session.conversation.id,
    language: session.conversation.language,
    channel: session.conversation.channel,
    createdAt: session.conversation.createdAt,
    updatedAt: session.conversation.updatedAt,
    presence: session.presence.state,
    awaitingReply: session.presence.awaitingReply,
    typingActive: session.presence.typingActive,
    activeTurnId: session.activeTurn?.id ?? null,
    latestPreview,
    latestMessageRole: latestPersistedMessage?.role ?? null,
    latestTimestamp,
  };
}

function buildConversationSummaryFromAccepted(
  accepted: AsyncChatAcceptedResponse,
  language: string | null,
): AsyncChatConversationSummary {
  const latestPendingInput = accepted.turn.inputs.at(-1);

  return {
    conversationId: accepted.conversationId,
    language: accepted.turn.locale ?? language,
    channel: 'webchat_async',
    createdAt: accepted.presence.acceptedAt ?? new Date().toISOString(),
    updatedAt: accepted.presence.acceptedAt ?? new Date().toISOString(),
    presence: accepted.presence.state,
    awaitingReply: accepted.presence.awaitingReply,
    typingActive: accepted.presence.typingActive,
    activeTurnId: accepted.turn.id,
    latestPreview:
      latestPendingInput?.content ?? accepted.turn.semanticInput ?? null,
    latestMessageRole: null,
    latestTimestamp: latestPendingInput?.receivedAt ?? accepted.presence.acceptedAt,
  };
}

function upsertConversationSummary(
  conversations: AsyncChatConversationSummary[],
  summary: AsyncChatConversationSummary,
) {
  const next = [
    summary,
    ...conversations.filter(
      (conversation) => conversation.conversationId !== summary.conversationId,
    ),
  ];

  return next.sort(
    (left, right) =>
      new Date(right.latestTimestamp ?? right.updatedAt).getTime() -
      new Date(left.latestTimestamp ?? left.updatedAt).getTime(),
  );
}

function toUiError(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function PublicChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    () => resolveConversationIdFromUrl(),
  );
  const [conversations, setConversations] = useState<AsyncChatConversationSummary[]>([]);
  const [session, setSession] = useState<AsyncChatSessionView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [templateReady, setTemplateReady] = useState(false);
  const typingSignalRef = useRef<{
    conversationId: string | null;
    active: boolean;
  }>({
    conversationId: null,
    active: false,
  });

  const conversationItems = useMemo(
    () => buildConversationItems(conversations),
    [conversations],
  );
  const transcript = useMemo(() => buildTranscript(session), [session]);
  const presenceState: AsyncPresenceState = session?.presence.state ?? 'idle';
  const typingActive = session?.presence.typingActive ?? false;

  const applyConversationSelection = useCallback((conversationId: string | null) => {
    setSelectedConversationId(conversationId);
    syncConversationIdToUrl(conversationId);
  }, []);

  const syncRecentConversations = useCallback(async () => {
    const next = await listAsyncChatConversations(12);
    setConversations(next);
    return next;
  }, []);

  const loadSession = useCallback(async (
    conversationId: string,
    options?: {
      silent?: boolean;
    },
  ) => {
    if (!options?.silent) {
      setIsSyncing(true);
    }
    try {
      const nextSession = await getAsyncChatSession(conversationId);
      setSession(nextSession);
      applyConversationSelection(conversationId);
      setConversations((previous) =>
        upsertConversationSummary(
          previous,
          buildConversationSummaryFromSession(nextSession),
        ),
      );
      setError(null);
      return nextSession;
    } catch (nextError) {
      if (!options?.silent) {
        setError(toUiError(nextError));
      }
      throw nextError;
    } finally {
      if (!options?.silent) {
        setIsSyncing(false);
      }
    }
  }, [applyConversationSelection]);

  const applyTypingPresence = useCallback(
    (conversationId: string, presence: AsyncChatSessionView['presence']) => {
      setSession((previous) =>
        previous?.conversation.id === conversationId
          ? {
              ...previous,
              presence,
            }
          : previous,
      );
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.conversationId === conversationId
            ? {
                ...conversation,
                presence: presence.state,
                awaitingReply: presence.awaitingReply,
                typingActive: presence.typingActive,
              }
            : conversation,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        await syncRecentConversations();
        if (cancelled) {
          return;
        }

        const preferredConversationId = resolveConversationIdFromUrl();

        if (preferredConversationId) {
          try {
            await loadSession(preferredConversationId);
          } catch {
            setSession(null);
            applyConversationSelection(null);
          }
        } else {
          setSession(null);
          applyConversationSelection(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(toUiError(nextError));
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applyConversationSelection, loadSession, syncRecentConversations]);

  useEffect(() => {
    if (!selectedConversationId || isBootstrapping) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const schedule = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        void loadSession(selectedConversationId, { silent: true })
          .then((nextSession) => {
            if (cancelled) {
              return;
            }

            schedule(
              nextSession.presence.state === 'idle' ||
                nextSession.presence.state === 'completed'
                ? IDLE_SESSION_POLL_MS
                : ACTIVE_SESSION_POLL_MS,
            );
          })
          .catch(() => {
            if (!cancelled) {
              schedule(IDLE_SESSION_POLL_MS);
            }
          });
      }, delayMs);
    };

    schedule(
      presenceState === 'idle' || presenceState === 'completed'
        ? IDLE_SESSION_POLL_MS
        : ACTIVE_SESSION_POLL_MS,
    );

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isBootstrapping, loadSession, presenceState, selectedConversationId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void syncRecentConversations().catch(() => undefined);
    }, RECENT_CONVERSATION_SYNC_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [syncRecentConversations]);

  useEffect(() => {
    const trackedConversationId = typingSignalRef.current.conversationId;
    if (
      trackedConversationId &&
      trackedConversationId !== selectedConversationId &&
      typingSignalRef.current.active
    ) {
      void reportAsyncChatTyping({
        conversationId: trackedConversationId,
        locale: navigator.language,
        isTyping: false,
      }).catch(() => undefined);
      typingSignalRef.current = {
        conversationId: selectedConversationId,
        active: false,
      };
    }

    if (!selectedConversationId) {
      return;
    }

    const normalizedDraft = draft.trim();
    let cancelled = false;
    let timeoutId: number | null = null;

    if (!normalizedDraft) {
      if (
        typingSignalRef.current.active &&
        typingSignalRef.current.conversationId === selectedConversationId
      ) {
        void reportAsyncChatTyping({
          conversationId: selectedConversationId,
          locale: navigator.language,
          isTyping: false,
        })
          .then((response) => {
            if (!cancelled) {
              applyTypingPresence(response.conversationId, response.presence);
            }
          })
          .catch(() => undefined);
      }

      typingSignalRef.current = {
        conversationId: selectedConversationId,
        active: false,
      };

      return () => {
        cancelled = true;
      };
    }

    timeoutId = window.setTimeout(() => {
      void reportAsyncChatTyping({
        conversationId: selectedConversationId,
        locale: navigator.language,
        isTyping: true,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }

          typingSignalRef.current = {
            conversationId: selectedConversationId,
            active: response.typingActive,
          };
          applyTypingPresence(response.conversationId, response.presence);
        })
        .catch(() => undefined);
    }, TYPING_HEARTBEAT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [applyTypingPresence, draft, selectedConversationId]);

  useEffect(
    () => () => {
      const activeTypingConversationId = typingSignalRef.current.conversationId;

      if (activeTypingConversationId && typingSignalRef.current.active) {
        void reportAsyncChatTyping({
          conversationId: activeTypingConversationId,
          locale: navigator.language,
          isTyping: false,
        }).catch(() => undefined);
      }
    },
    [],
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      applyConversationSelection(conversationId);
      setSession(null);
      void loadSession(conversationId);
    },
    [applyConversationSelection, loadSession],
  );

  const handleStartConversation = useCallback(() => {
    applyConversationSelection(null);
    setSession(null);
    setDraft('');
    setError(null);
    setIsSyncing(false);
  }, [applyConversationSelection]);

  const handleSend = useCallback(async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }

    setIsSending(true);
    setDraft('');
    setError(null);

    try {
      if (selectedConversationId) {
        const typingResponse = await reportAsyncChatTyping({
          conversationId: selectedConversationId,
          locale: navigator.language,
          isTyping: false,
        }).catch(() => null);

        typingSignalRef.current = {
          conversationId: selectedConversationId,
          active: false,
        };

        if (typingResponse) {
          applyTypingPresence(typingResponse.conversationId, typingResponse.presence);
        }
      }

      const accepted = await acceptAsyncChatMessage({
        conversationId: selectedConversationId ?? undefined,
        message,
        locale: navigator.language,
        channel: 'webchat_async',
      });
      applyConversationSelection(accepted.conversationId);
      setConversations((previous) =>
        upsertConversationSummary(
          previous,
          buildConversationSummaryFromAccepted(accepted, navigator.language),
        ),
      );
      setSession((previous) =>
        buildOptimisticSession(
          previous?.conversation.id === accepted.conversationId ? previous : null,
          accepted,
          navigator.language,
        ),
      );
      await loadSession(accepted.conversationId);
      await syncRecentConversations();
    } catch (nextError) {
      setDraft(message);
      setError(toUiError(nextError));
    } finally {
      setIsSending(false);
    }
  }, [
    applyConversationSelection,
    draft,
    loadSession,
    selectedConversationId,
    syncRecentConversations,
  ]);

  return (
    <>
      <TemplateAssetBundle bundle="chat" onReadyChange={setTemplateReady} />
      <PublicChatShell
        conversations={conversationItems}
        selectedConversationId={selectedConversationId}
        transcript={transcript}
        draft={draft}
        isBootstrapping={isBootstrapping}
        isSyncing={isSyncing}
        isSending={isSending}
        error={error}
        presenceState={presenceState}
        typingActive={typingActive}
        showGlobalLoader={!templateReady}
        onConversationSelect={handleConversationSelect}
        onStartConversation={handleStartConversation}
        onDraftChange={setDraft}
        onSend={handleSend}
      />
    </>
  );
}
