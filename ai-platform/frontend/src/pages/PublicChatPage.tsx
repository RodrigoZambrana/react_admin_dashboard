import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  acceptAsyncChatMessage,
  getAsyncChatSession,
  listAsyncChatConversations,
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

function toUiError(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

export function PublicChatPage() {
  const [conversations, setConversations] = useState<AsyncChatConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [session, setSession] = useState<AsyncChatSessionView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const conversationItems = useMemo(
    () => buildConversationItems(conversations),
    [conversations],
  );
  const transcript = useMemo(() => buildTranscript(session), [session]);
  const presenceState: AsyncPresenceState = session?.presence.state ?? 'idle';

  const syncRecentConversations = useCallback(async () => {
    const next = await listAsyncChatConversations(12);
    setConversations(next);
    return next;
  }, []);

  const loadSession = useCallback(async (conversationId: string) => {
    setIsSyncing(true);
    try {
      const nextSession = await getAsyncChatSession(conversationId);
      setSession(nextSession);
      setSelectedConversationId(conversationId);
      setError(null);
      return nextSession;
    } catch (nextError) {
      setError(toUiError(nextError));
      throw nextError;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const recent = await syncRecentConversations();
        if (cancelled) {
          return;
        }

        const firstConversationId = recent[0]?.conversationId ?? null;
        if (firstConversationId) {
          await loadSession(firstConversationId);
        } else {
          setSession(null);
          setSelectedConversationId(null);
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
  }, [loadSession, syncRecentConversations]);

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      void loadSession(conversationId);
    },
    [loadSession],
  );

  const handleSend = useCallback(async () => {
    const message = draft.trim();
    if (!message) {
      return;
    }

    setIsSending(true);
    setDraft('');
    setError(null);

    try {
      const accepted = await acceptAsyncChatMessage({
        conversationId: selectedConversationId ?? undefined,
        message,
        locale: navigator.language,
        channel: 'webchat_async',
      });
      setSelectedConversationId(accepted.conversationId);
      setSession((previous) =>
        buildOptimisticSession(
          previous?.conversation.id === accepted.conversationId ? previous : null,
          accepted,
          navigator.language,
        ),
      );
      await syncRecentConversations();
      await loadSession(accepted.conversationId);
    } catch (nextError) {
      setDraft(message);
      setError(toUiError(nextError));
    } finally {
      setIsSending(false);
    }
  }, [draft, loadSession, selectedConversationId, syncRecentConversations]);

  return (
    <>
      <TemplateAssetBundle bundle="chat" />
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
        onConversationSelect={handleConversationSelect}
        onDraftChange={setDraft}
        onSend={handleSend}
      />
    </>
  );
}
