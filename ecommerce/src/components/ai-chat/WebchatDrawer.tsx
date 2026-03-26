"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  IconLoader2,
  IconRefresh,
  IconRobotFace,
  IconSend2,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";

import { useWebchat } from "@/state/webchat-context";

import styles from "./WebchatDrawer.module.css";

const timeFormatter = new Intl.DateTimeFormat("es-UY", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return timeFormatter.format(date);
};

const formatAttachmentLabel = (attachment: {
  fileName?: string;
  assetType?: string;
  contentType?: string;
  textContent?: string;
}) => {
  const base = attachment.fileName || attachment.assetType || attachment.contentType || "Adjunto";
  if (attachment.textContent) {
    return `${base} · ${attachment.textContent}`;
  }
  return base;
};

export default function WebchatDrawer() {
  const {
    isOpen,
    isReady,
    isHydrating,
    isSending,
    isSyncing,
    close,
    messages,
    sendMessage,
    error,
    session,
    controlMode,
    needsHuman,
    taskSummary,
    lastSyncedAt,
    refresh,
  } = useWebchat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextDraft = draft.trim();
    if (!nextDraft) {
      return;
    }
    setDraft("");
    await sendMessage(nextDraft);
  };

  if (!isOpen) {
    return null;
  }

  const modeText = needsHuman || controlMode === "human"
    ? "Asesor humano"
    : controlMode === "hybrid"
      ? "IA + equipo"
      : "Asistente IA";

  const lastSeen = isHydrating
    ? "Recuperando historial"
    : isSending
      ? "Enviando mensaje"
      : isSyncing
        ? "Actualizando conversación"
        : lastSyncedAt
          ? `Sincronizado ${formatMessageTime(lastSyncedAt)}`
          : modeText;

  const canSend = Boolean(draft.trim()) && !isSending && isReady;
  const headerTitle = session?.scope === "customer_authenticated"
    ? "Atención personalizada"
    : "Centro de ayuda";
  const scopeLabel = session?.scope === "customer_authenticated"
    ? "Cliente identificado"
    : "Consulta pública";

  return (
    <div className={styles.chat} data-testid="storefront-webchat-drawer">
      <div className={styles.chatHeader}>
        <div className={styles.userDetails}>
          <div className={styles.avatar}>
            <Image
              src="/assets/images/chat/dreamschat-mark.svg"
              alt="Chat"
              width={48}
              height={48}
              className={styles.avatarImage}
            />
          </div>
          <div className={styles.userMeta}>
            <h6>{headerTitle}</h6>
            <span className={styles.lastSeen}>{lastSeen}</span>
            <div className={styles.metaRow}>
              <span
                className={styles.modePill}
                data-testid="storefront-webchat-mode"
              >
                {modeText}
              </span>
              <span className={styles.scopePill}>{scopeLabel}</span>
            </div>
          </div>
        </div>

        <div className={styles.chatOptions}>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => void refresh()}
                className={styles.optionButton}
                data-testid="storefront-webchat-refresh"
                aria-label="Actualizar conversación"
              >
                {isSyncing ? <IconLoader2 size={16} className="animate-spin" /> : <IconRefresh size={16} />}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={close}
                className={styles.optionButton}
                data-testid="storefront-webchat-close"
                aria-label="Cerrar chat"
              >
                <IconX size={16} />
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={styles.chatBody}
        data-testid="storefront-webchat-messages"
      >
        <div className={styles.messages}>
          <div className={styles.chatLine}>
            <span className={styles.chatDate}>{taskSummary || modeText}</span>
          </div>
          <div className={styles.statusRow} data-testid="storefront-webchat-status">
            {lastSeen}
          </div>

          {isHydrating && messages.length === 0 ? (
            <div className={styles.chats}>
              <div className={styles.chatAvatar}>
                <div className={styles.avatarShell}>
                  <Image
                    src="/assets/images/chat/dreamschat-mark.svg"
                    alt="Chat"
                    width={40}
                    height={40}
                    className={styles.chatAvatarImage}
                  />
                </div>
              </div>
              <div className={styles.chatContent}>
                <div className={styles.chatProfileName}>
                  <h6>
                    {headerTitle}
                    <span className={styles.chatTime}>ahora</span>
                  </h6>
                </div>
                <div className={styles.messageContent}>
                  <span className={styles.typing}>
                    cargando
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {!isHydrating && messages.length === 0 ? (
            <div className={styles.chats}>
              <div className={styles.chatAvatar}>
                <div className={styles.avatarShell}>
                  <Image
                    src="/assets/images/chat/dreamschat-mark.svg"
                    alt="Chat"
                    width={40}
                    height={40}
                    className={styles.chatAvatarImage}
                  />
                </div>
              </div>
              <div className={styles.chatContent}>
                <div className={styles.chatProfileName}>
                  <h6>
                    {headerTitle}
                    <span className={styles.chatTime}>ahora</span>
                  </h6>
                </div>
                <div className={styles.messageContent}>
                  Hola. Puedes consultarnos por productos, precios, envíos o seguimiento.
                </div>
              </div>
            </div>
          ) : null}

          {messages.map((message) => {
            const isCustomer = message.role === "customer";
            return (
              <div
                key={message.id}
                className={`${styles.chats} ${isCustomer ? styles.chatsRight : ""}`}
                data-testid={`storefront-webchat-message-${isCustomer ? "customer" : "agent"}`}
              >
                <div className={styles.chatAvatar}>
                  {isCustomer ? (
                    <div className={`${styles.avatarShell} ${styles.customerAvatarShell}`}>
                      <IconUserCircle size={28} stroke={1.7} />
                    </div>
                  ) : (
                    <div className={styles.avatarShell}>
                      <Image
                        src="/assets/images/chat/dreamschat-mark.svg"
                        alt="Chat"
                        width={40}
                        height={40}
                        className={styles.chatAvatarImage}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.chatContent}>
                  <div className={styles.chatProfileName}>
                    <h6>
                      {isCustomer ? "Tú" : headerTitle}
                      <span className={styles.chatTime}>{formatMessageTime(message.createdAt)}</span>
                    </h6>
                  </div>

                  {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                    message.attachments.map((attachment, index) => (
                      <div
                        key={`${message.id}-attachment-${index}`}
                        className={styles.messageContent}
                      >
                        <div className={styles.fileAttach}>
                          <span className={styles.fileIcon}>
                            {attachment.assetType?.slice(0, 1)?.toUpperCase() || "A"}
                          </span>
                          <div className={styles.fileDetails}>
                            <h6>{attachment.fileName || "Adjunto"}</h6>
                            <p>{formatAttachmentLabel(attachment)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : null}

                  <div className={`${styles.messageContent} ${message.pending ? styles.pendingMessage : ""}`}>
                    <div className={styles.messageText}>{message.text}</div>
                  </div>

                  {message.pending ? (
                    <div className={styles.pendingMeta}>Pendiente</div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {error ? (
            <div className={styles.chats}>
              <div className={styles.chatAvatar}>
                <div className={styles.avatarShell}>
                  <IconRobotFace size={24} stroke={1.7} />
                </div>
              </div>
              <div className={styles.chatContent}>
                <div className={styles.chatProfileName}>
                  <h6>
                    Sistema
                    <span className={styles.chatTime}>ahora</span>
                  </h6>
                </div>
                <div
                  className={`${styles.messageContent} ${styles.errorMessage}`}
                  data-testid="storefront-webchat-error"
                >
                  {error}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.chatFooter}>
        <form className={styles.footerForm} onSubmit={handleSubmit}>
          <div className={styles.chatFooterWrap}>
            <div className={styles.formWrap}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={1}
                placeholder="Type Your Message"
                className={styles.formControl}
                data-testid="storefront-webchat-input"
              />
            </div>
            <div className={styles.formBtn}>
              <button
                className={styles.sendButton}
                type="submit"
                disabled={!canSend}
                data-testid="storefront-webchat-send"
                aria-label="Enviar mensaje"
              >
                {isSending ? <IconLoader2 size={16} className="animate-spin" /> : <IconSend2 size={16} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
