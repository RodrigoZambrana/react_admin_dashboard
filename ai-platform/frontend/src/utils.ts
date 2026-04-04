export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function toPrettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function formatChatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatChatListTime(value: string | null) {
  if (!value) {
    return 'Now';
  }

  const parsed = new Date(value);
  const now = new Date();
  const sameDay = parsed.toDateString() === now.toDateString();

  if (sameDay) {
    return formatChatMessageTime(value);
  }

  return parsed.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export function formatChatPresenceLabel(state: string) {
  switch (state) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return 'Analyzing';
    case 'awaiting_reply':
      return 'Typing';
    case 'completed':
    case 'idle':
      return 'Online';
    case 'failed':
      return 'Retry available';
    case 'superseded':
      return 'Updated';
    default:
      return 'Online';
  }
}

export function getConversationDisplayTitle(value: string) {
  return value.trim() || 'AI Concierge';
}

export function getConversationPreview(value: string) {
  const normalized = value.trim();
  return normalized || 'Async chat is ready for your next message.';
}

export function getConversationStatusTone(
  state: string,
  awaitingReply: boolean,
) {
  if (awaitingReply || state === 'processing' || state === 'awaiting_reply') {
    return {
      avatarClass: 'online',
    };
  }

  if (state === 'queued') {
    return {
      avatarClass: 'bg-primary avatar-rounded',
    };
  }

  return {
    avatarClass: 'online',
  };
}
