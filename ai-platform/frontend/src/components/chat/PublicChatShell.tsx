import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type FormEvent,
  type MouseEvent,
  type UIEvent,
} from 'react';

import type { AsyncPresenceState } from '../../types';
import {
  formatChatListTime,
  formatChatMessageTime,
  formatChatPresenceLabel,
  getConversationDisplayTitle,
  getConversationPreview,
  getConversationStatusTone,
} from '../../utils';

export type PublicChatConversationListItem = {
  conversationId: string;
  title: string;
  preview: string;
  timestamp: string | null;
  presence: AsyncPresenceState;
  awaitingReply: boolean;
  typingActive: boolean;
  activeTurnId: string | null;
};

export type PublicChatTranscriptItem = {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  pending?: boolean;
  typing?: boolean;
  stateLabel?: string | null;
};

type PublicChatShellProps = {
  conversations: PublicChatConversationListItem[];
  selectedConversationId: string | null;
  transcript: PublicChatTranscriptItem[];
  draft: string;
  isBootstrapping: boolean;
  isSyncing: boolean;
  isSending: boolean;
  error: string | null;
  presenceState: AsyncPresenceState;
  typingActive: boolean;
  showGlobalLoader: boolean;
  onConversationSelect: (conversationId: string) => void;
  onStartConversation: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
};

const assistantAvatar = '/dreamschat-chat/assets/img/profiles/avatar-06.jpg';
const userAvatar = '/dreamschat-chat/assets/img/profiles/avatar-17.jpg';
const recentAvatars = [
  '/dreamschat-chat/assets/img/profiles/avatar-11.jpg',
  '/dreamschat-chat/assets/img/profiles/avatar-12.jpg',
  '/dreamschat-chat/assets/img/profiles/avatar-14.jpg',
  '/dreamschat-chat/assets/img/profiles/avatar-15.jpg',
  '/dreamschat-chat/assets/img/profiles/avatar-01.jpg',
  '/dreamschat-chat/assets/img/profiles/avatar-05.jpg',
];

function buildHeaderSubtitle(
  state: AsyncPresenceState,
  isSyncing: boolean,
  typingActive: boolean,
) {
  if (typingActive) {
    return 'Finishing your message';
  }

  if (isSyncing && state === 'idle') {
    return 'Syncing';
  }

  return formatChatPresenceLabel(state);
}

export function PublicChatShell({
  conversations,
  selectedConversationId,
  transcript,
  draft,
  isBootstrapping,
  isSyncing,
  isSending,
  error,
  presenceState,
  typingActive,
  showGlobalLoader,
  onConversationSelect,
  onStartConversation,
  onDraftChange,
  onSend,
}: PublicChatShellProps) {
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);

  const handleNoopClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  const handleNoopSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const selectedConversation =
    conversations.find((conversation) => conversation.conversationId === selectedConversationId) ??
    null;
  const headerTitle = selectedConversation
    ? selectedConversation.title
    : 'AI Concierge';
  const headerSubtitle = buildHeaderSubtitle(
    presenceState,
    isSyncing,
    typingActive,
  );

  const scrollAnchorKey = useMemo(() => {
    const lastEntry = transcript.at(-1);

    return [
      selectedConversationId ?? 'none',
      transcript.length,
      lastEntry?.id ?? 'none',
      lastEntry?.createdAt ?? 'none',
      lastEntry?.typing ? 'typing' : 'static',
      lastEntry?.pending ? 'pending' : 'settled',
      presenceState,
    ].join('|');
  }, [presenceState, selectedConversationId, transcript]);

  useLayoutEffect(() => {
    const viewport = transcriptViewportRef.current;

    if (!viewport) {
      return;
    }

    const conversationChanged =
      previousConversationIdRef.current !== selectedConversationId;

    if (conversationChanged || shouldStickToBottomRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
    }

    previousConversationIdRef.current = selectedConversationId;
  }, [scrollAnchorKey, selectedConversationId]);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
  }, [selectedConversationId]);

  const handleTranscriptScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const remainingDistance =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    shouldStickToBottomRef.current = remainingDistance <= 48;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <>
      {showGlobalLoader ? (
        <div id="global-loader">
          <div className="page-loader"></div>
        </div>
      ) : null}
      <div className="main-wrapper public-chat-shell">
        <div className="content main_content">
          <div className="sidebar-menu">
            <div className="logo">
              <a href="/chat" className="logo-normal">
                <img src="/dreamschat-chat/assets/img/logo.svg" alt="DreamsChat" />
              </a>
            </div>
            <div className="menu-wrap">
              <div className="main-menu">
                <ul className="nav">
                  <li
                    className="active"
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Chats"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="/chat" className="active">
                      <i className="ti ti-message-2-heart"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Contacts"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-user-shield"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Groups"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-users-group"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Status"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-circle-dot"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Calls"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-phone-call"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Profile"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-user-circle"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Settings"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-settings"></i>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="profile-menu">
                <ul>
                  <li>
                    <a href="#" id="dark-mode-toggle" className="dark-mode-toggle active" onClick={handleNoopClick}>
                      <i className="ti ti-moon"></i>
                    </a>
                    <a href="#" id="light-mode-toggle" className="dark-mode-toggle" onClick={handleNoopClick}>
                      <i className="ti ti-sun"></i>
                    </a>
                  </li>
                  <li>
                    <div className="dropdown">
                      <a href="#" className="avatar avatar-md" data-bs-toggle="dropdown" onClick={handleNoopClick}>
                        <img
                          src={userAvatar}
                          alt="You"
                          className="rounded-circle"
                        />
                      </a>
                      <div className="dropdown-menu dropdown-menu-end p-3">
                        <a href="/" className="dropdown-item">
                          <i className="ti ti-layout-dashboard me-2"></i>Admin Workspace
                        </a>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="sidebar-group" style={{ minHeight: 0 }}>
            <div className="tab-content" style={{ height: '100%', minHeight: 0 }}>
              <div
                className="tab-pane fade active show"
                id="chat-menu"
                style={{ height: '100%', minHeight: 0 }}
              >
                <div
                  id="chats"
                  className="sidebar-content active slimscroll"
                  style={{ height: '100%', minHeight: 0 }}
                >
                  <div
                    className="slimscroll"
                    style={{
                      height: '100%',
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div className="chat-search-header">
                      <div className="header-title d-flex align-items-center justify-content-between">
                        <h4 className="mb-3">Chats</h4>
                        <div className="d-flex align-items-center mb-3">
                          <a
                            href="#"
                            className="add-icon btn btn-primary p-0 d-flex align-items-center justify-content-center fs-16 me-2"
                            onClick={(event) => {
                              event.preventDefault();
                              onStartConversation();
                            }}
                          >
                            <i className="ti ti-plus"></i>
                          </a>
                          <div className="dropdown">
                            <a href="#" data-bs-toggle="dropdown" className="fs-16 text-default" onClick={handleNoopClick}>
                              <i className="ti ti-dots-vertical"></i>
                            </a>
                            <ul className="dropdown-menu p-3">
                              <li>
                                <a className="dropdown-item" href="#" onClick={handleNoopClick}>
                                  <i className="ti ti-device-desktop me-2"></i>Async session sync
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="search-wrap">
                        <form onSubmit={handleNoopSubmit}>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Search For Contacts or Messages"
                              readOnly
                              value={selectedConversation?.preview ?? ''}
                            />
                            <span className="input-group-text">
                              <i className="ti ti-search"></i>
                            </span>
                          </div>
                        </form>
                      </div>
                    </div>

                    <div className="top-online-contacts">
                      <div className="d-flex align-items-center justify-content-between">
                        <h5 className="mb-3">Recent Chats</h5>
                        <div className="dropdown mb-3">
                          <a href="#" className="text-default" data-bs-toggle="dropdown" onClick={handleNoopClick}>
                            <i className="ti ti-dots-vertical"></i>
                          </a>
                          <ul className="dropdown-menu dropdown-menu-end p-3">
                            <li>
                              <a className="dropdown-item mb-1" href="#" onClick={handleNoopClick}>
                                <i className="ti ti-clock me-2"></i>Async delivery
                              </a>
                            </li>
                            <li>
                              <a className="dropdown-item" href="#" onClick={handleNoopClick}>
                                <i className="ti ti-refresh me-2"></i>Session recovery
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="swiper-container overflow-hidden">
                        <div className="swiper-wrapper">
                          {conversations.slice(0, 6).map((conversation, index) => (
                            <div className="swiper-slide" key={conversation.conversationId}>
                              <button
                                type="button"
                                className="chat-status text-center public-chat-avatar-button"
                                onClick={() => onConversationSelect(conversation.conversationId)}
                              >
                                <div className="avatar avatar-lg online d-block">
                                  <img
                                    src={recentAvatars[index % recentAvatars.length]}
                                    alt={conversation.title}
                                    className="rounded-circle"
                                  />
                                </div>
                                <p>{getConversationDisplayTitle(conversation.title)}</p>
                              </button>
                            </div>
                          ))}
                          {conversations.length === 0 ? (
                            <div className="swiper-slide">
                              <button
                                type="button"
                                className="chat-status text-center public-chat-avatar-button"
                                onClick={onStartConversation}
                              >
                                <div className="avatar avatar-lg bg-primary avatar-rounded">
                                  <span className="avatar-title fs-14 fw-medium">AI</span>
                                </div>
                                <p>New Chat</p>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div
                      className="sidebar-body chat-body"
                      id="chatsidebar"
                      style={{
                        flex: '1 1 auto',
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="chat-title">All Chats</h5>
                        <div className="dropdown">
                          <a href="#" className="text-default fs-16" data-bs-toggle="dropdown" onClick={handleNoopClick}>
                            <i className="ti ti-filter"></i>
                          </a>
                          <ul className="dropdown-menu dropdown-menu-end p-3">
                            <li>
                              <a className="dropdown-item active" href="#" onClick={handleNoopClick}>
                                All Chats
                              </a>
                            </li>
                            <li>
                              <a className="dropdown-item" href="#" onClick={handleNoopClick}>
                                Async Sessions
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div
                        className="chat-users-wrap"
                        style={{
                          flex: '1 1 auto',
                          minHeight: 0,
                          overflowY: 'auto',
                          paddingRight: '0.25rem',
                        }}
                      >
                        {conversations.map((conversation, index) => {
                          const isSelected =
                            conversation.conversationId === selectedConversationId;
                          const tone = getConversationStatusTone(
                            conversation.presence,
                            conversation.awaitingReply,
                            {
                              typingActive: conversation.typingActive,
                            },
                          );

                          return (
                            <div className="chat-list" key={conversation.conversationId}>
                              <button
                                type="button"
                                className={`chat-user-list public-chat-list-button${
                                  isSelected ? ' active' : ''
                                }`}
                                onClick={() => onConversationSelect(conversation.conversationId)}
                              >
                                <div className={`avatar avatar-lg ${tone.avatarClass} me-2`}>
                                  <img
                                    src={recentAvatars[index % recentAvatars.length]}
                                    className="rounded-circle"
                                    alt={conversation.title}
                                  />
                                </div>
                                <div className="chat-user-info">
                                  <div className="chat-user-msg">
                                    <h6>{getConversationDisplayTitle(conversation.title)}</h6>
                                    {conversation.typingActive ? (
                                      <p>
                                        {formatChatPresenceLabel(conversation.presence, {
                                          typingActive: true,
                                        })}
                                      </p>
                                    ) : conversation.awaitingReply ? (
                                      <p>
                                        <span className="animate-typing">
                                          {formatChatPresenceLabel(conversation.presence)}
                                          <span className="dot"></span>
                                          <span className="dot"></span>
                                          <span className="dot"></span>
                                        </span>
                                      </p>
                                    ) : (
                                      <p>{getConversationPreview(conversation.preview)}</p>
                                    )}
                                  </div>
                                  <div className="chat-user-time">
                                    <span className="time">
                                      {formatChatListTime(conversation.timestamp)}
                                    </span>
                                    <div className="chat-pin">
                                      {conversation.awaitingReply &&
                                      !conversation.typingActive ? (
                                        <span className="count-message fs-12 fw-semibold">
                                          Live
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </div>
                          );
                        })}

                        {!isBootstrapping && conversations.length === 0 ? (
                          <div className="chat-list">
                            <div className="chat-user-list public-chat-empty-list">
                              <div className="avatar avatar-lg bg-primary avatar-rounded me-2">
                                <span className="avatar-title fs-14 fw-medium">AI</span>
                              </div>
                              <div className="chat-user-info">
                                <div className="chat-user-msg">
                                  <h6>Start your first chat</h6>
                                  <p>Async user chat is ready for a new conversation.</p>
                                </div>
                              </div>
                              <div className="chat-user-time">
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={onStartConversation}
                                >
                                  New Chat
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="chat chat-messages show" id="middle">
            <div>
              <div className="chat-header">
                <div className="user-details">
                  <div className="d-xl-none">
                    <a className="text-muted chat-close me-2" href="#" onClick={handleNoopClick}>
                      <i className="fas fa-arrow-left"></i>
                    </a>
                  </div>
                  <div className="avatar avatar-lg online flex-shrink-0">
                    <img
                      src={assistantAvatar}
                      className="rounded-circle"
                      alt={headerTitle}
                    />
                  </div>
                  <div className="ms-2 overflow-hidden">
                    <h6>{headerTitle}</h6>
                    <span className="last-seen">{headerSubtitle}</span>
                  </div>
                </div>
                <div className="chat-options">
                  <ul>
                    <li>
                      <a href="#" className="btn chat-search-btn" onClick={handleNoopClick}>
                        <i className="ti ti-search"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="btn" onClick={handleNoopClick}>
                        <i className="ti ti-clock-hour-4"></i>
                      </a>
                    </li>
                    <li>
                      <a href="#" className="btn" onClick={handleNoopClick}>
                        <i className="ti ti-info-circle"></i>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div
                ref={transcriptViewportRef}
                className="chat-body chat-page-group slimscroll"
                onScroll={handleTranscriptScroll}
              >
                <div className="messages">
                  {!selectedConversationId && !isBootstrapping ? (
                    <div className="public-chat-welcome-state">
                      <div className="message-content">
                        Choose a conversation from the left rail or send a first message to
                        open a new async chat session.
                      </div>
                    </div>
                  ) : null}

                  {transcript.map((entry) => {
                    const isUser = entry.role === 'USER';

                    return (
                      <div
                        key={entry.id}
                        className={`chats${isUser ? ' chats-right' : ''}`}
                      >
                        {!isUser ? (
                          <div className="chat-avatar">
                            <img
                              src={assistantAvatar}
                              className="rounded-circle"
                              alt="Assistant"
                            />
                          </div>
                        ) : null}

                        <div className="chat-content">
                          <div
                            className={`chat-profile-name${
                              isUser ? ' text-end justify-content-end' : ''
                            }`}
                          >
                            <h6>
                              {isUser ? 'You' : 'AI Concierge'}
                              <i className="ti ti-circle-filled fs-7 mx-2"></i>
                              <span className="chat-time">
                                {formatChatMessageTime(entry.createdAt)}
                              </span>
                              {entry.pending ? (
                                <span className="msg-read">
                                  <i className="ti ti-clock"></i>
                                </span>
                              ) : (
                                <span className="msg-read success">
                                  <i className="ti ti-checks"></i>
                                </span>
                              )}
                            </h6>
                          </div>
                          <div className={entry.typing ? 'message-content' : 'chat-info'}>
                            {isUser ? (
                              <div className="chat-actions">
                                <a href="#" onClick={handleNoopClick}>
                                  <i className="ti ti-dots-vertical"></i>
                                </a>
                              </div>
                            ) : null}
                            <div className="message-content">
                              {entry.typing ? (
                                <span className="animate-typing">
                                  {entry.stateLabel ?? 'Typing'}
                                  <span className="dot"></span>
                                  <span className="dot"></span>
                                  <span className="dot"></span>
                                </span>
                              ) : (
                                entry.content
                              )}
                            </div>
                          </div>
                        </div>

                        {isUser ? (
                          <div className="chat-avatar">
                            <img
                              src={userAvatar}
                              className="rounded-circle dreams_chat"
                              alt="You"
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {error ? (
                    <div className="public-chat-error-banner">{error}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="chat-footer">
              <form className="footer-form" onSubmit={handleSubmit}>
                <div className="chat-footer-wrap">
                  <div className="form-item">
                    <a href="#" className="action-circle" onClick={handleNoopClick}>
                      <i className="ti ti-microphone"></i>
                    </a>
                  </div>
                  <div className="form-wrap">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Type Your Message"
                      value={draft}
                      onChange={(event) => onDraftChange(event.target.value)}
                    />
                  </div>
                  <div className="form-item emoj-action-foot">
                    <a href="#" className="action-circle" onClick={handleNoopClick}>
                      <i className="ti ti-mood-smile"></i>
                    </a>
                  </div>
                  <div className="form-item position-relative d-flex align-items-center justify-content-center">
                    <a href="#" className="action-circle file-action position-absolute" onClick={handleNoopClick}>
                      <i className="ti ti-folder"></i>
                    </a>
                    <input type="file" className="open-file position-relative" name="files" id="files" disabled />
                  </div>
                  <div className="form-item">
                    <a href="#" onClick={handleNoopClick}>
                      <i className="ti ti-dots-vertical"></i>
                    </a>
                  </div>
                  <div className="form-btn">
                    <button className="btn btn-primary" type="submit" disabled={isSending}>
                      <i className="ti ti-send"></i>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
