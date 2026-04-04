import type { FormEvent } from 'react';

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
  onConversationSelect: (conversationId: string) => void;
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

function buildHeaderSubtitle(state: AsyncPresenceState, isSyncing: boolean) {
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
  onConversationSelect,
  onDraftChange,
  onSend,
}: PublicChatShellProps) {
  const selectedConversation =
    conversations.find((conversation) => conversation.conversationId === selectedConversationId) ??
    null;
  const headerTitle = selectedConversation
    ? selectedConversation.title
    : 'AI Concierge';
  const headerSubtitle = buildHeaderSubtitle(presenceState, isSyncing);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <>
      <div id="global-loader">
        <div className="page-loader"></div>
      </div>
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
                    <a href="javascript:void(0);">
                      <i className="ti ti-user-shield"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Groups"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="javascript:void(0);">
                      <i className="ti ti-users-group"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Status"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="javascript:void(0);">
                      <i className="ti ti-circle-dot"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Calls"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="javascript:void(0);">
                      <i className="ti ti-phone-call"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Profile"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="javascript:void(0);">
                      <i className="ti ti-user-circle"></i>
                    </a>
                  </li>
                  <li
                    data-bs-toggle="tooltip"
                    data-bs-placement="right"
                    data-bs-original-title="Settings"
                    data-bs-custom-class="tooltip-primary"
                  >
                    <a href="javascript:void(0);">
                      <i className="ti ti-settings"></i>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="profile-menu">
                <ul>
                  <li>
                    <a href="javascript:void(0);" id="dark-mode-toggle" className="dark-mode-toggle active">
                      <i className="ti ti-moon"></i>
                    </a>
                    <a href="javascript:void(0);" id="light-mode-toggle" className="dark-mode-toggle">
                      <i className="ti ti-sun"></i>
                    </a>
                  </li>
                  <li>
                    <div className="dropdown">
                      <a href="javascript:void(0);" className="avatar avatar-md" data-bs-toggle="dropdown">
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

          <div className="sidebar-group">
            <div className="tab-content">
              <div className="tab-pane fade active show" id="chat-menu">
                <div id="chats" className="sidebar-content active slimscroll">
                  <div className="slimscroll">
                    <div className="chat-search-header">
                      <div className="header-title d-flex align-items-center justify-content-between">
                        <h4 className="mb-3">Chats</h4>
                        <div className="d-flex align-items-center mb-3">
                          <a
                            href="javascript:void(0);"
                            className="add-icon btn btn-primary p-0 d-flex align-items-center justify-content-center fs-16 me-2"
                          >
                            <i className="ti ti-plus"></i>
                          </a>
                          <div className="dropdown">
                            <a href="javascript:void(0);" data-bs-toggle="dropdown" className="fs-16 text-default">
                              <i className="ti ti-dots-vertical"></i>
                            </a>
                            <ul className="dropdown-menu p-3">
                              <li>
                                <a className="dropdown-item" href="javascript:void(0);">
                                  <i className="ti ti-device-desktop me-2"></i>Async session sync
                                </a>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="search-wrap">
                        <form action="javascript:void(0);">
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
                          <a href="javascript:void(0);" className="text-default" data-bs-toggle="dropdown">
                            <i className="ti ti-dots-vertical"></i>
                          </a>
                          <ul className="dropdown-menu dropdown-menu-end p-3">
                            <li>
                              <a className="dropdown-item mb-1" href="javascript:void(0);">
                                <i className="ti ti-clock me-2"></i>Async delivery
                              </a>
                            </li>
                            <li>
                              <a className="dropdown-item" href="javascript:void(0);">
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
                              <div className="chat-status text-center">
                                <div className="avatar avatar-lg bg-primary avatar-rounded">
                                  <span className="avatar-title fs-14 fw-medium">AI</span>
                                </div>
                                <p>New Chat</p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="sidebar-body chat-body" id="chatsidebar">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="chat-title">All Chats</h5>
                        <div className="dropdown">
                          <a href="javascript:void(0);" className="text-default fs-16" data-bs-toggle="dropdown">
                            <i className="ti ti-filter"></i>
                          </a>
                          <ul className="dropdown-menu dropdown-menu-end p-3">
                            <li>
                              <a className="dropdown-item active" href="javascript:void(0);">
                                All Chats
                              </a>
                            </li>
                            <li>
                              <a className="dropdown-item" href="javascript:void(0);">
                                Async Sessions
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div className="chat-users-wrap">
                        {conversations.map((conversation, index) => {
                          const isSelected =
                            conversation.conversationId === selectedConversationId;
                          const tone = getConversationStatusTone(
                            conversation.presence,
                            conversation.awaitingReply,
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
                                    {conversation.awaitingReply ? (
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
                                      {conversation.awaitingReply ? (
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
                    <a className="text-muted chat-close me-2" href="javascript:void(0);">
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
                      <a href="javascript:void(0)" className="btn chat-search-btn">
                        <i className="ti ti-search"></i>
                      </a>
                    </li>
                    <li>
                      <a href="javascript:void(0)" className="btn">
                        <i className="ti ti-clock-hour-4"></i>
                      </a>
                    </li>
                    <li>
                      <a href="javascript:void(0)" className="btn">
                        <i className="ti ti-info-circle"></i>
                      </a>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="chat-body chat-page-group slimscroll">
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
                                <a href="javascript:void(0);">
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
                    <a href="javascript:void(0);" className="action-circle">
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
                    <a href="javascript:void(0);" className="action-circle">
                      <i className="ti ti-mood-smile"></i>
                    </a>
                  </div>
                  <div className="form-item position-relative d-flex align-items-center justify-content-center">
                    <a href="javascript:void(0);" className="action-circle file-action position-absolute">
                      <i className="ti ti-folder"></i>
                    </a>
                    <input type="file" className="open-file position-relative" name="files" id="files" disabled />
                  </div>
                  <div className="form-item">
                    <a href="javascript:void(0);">
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
