"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  IconPaperclip,
  IconLoader2,
  IconRefresh,
  IconRobotFace,
  IconSend2,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";

import { useWebchat } from "@/state/webchat-context";
import type { WebchatMessageAttachment } from "@/types/conversations";

import styles from "./WebchatDrawer.module.css";

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES =
  ".png,.jpg,.jpeg,.webp,.gif,.webm,.ogg,.mp3,.wav,.mp4,.mov,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.md,.json,image/png,image/jpeg,image/webp,image/gif,audio/webm,audio/ogg,audio/mpeg,audio/mp3,audio/wav,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/markdown,application/json,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
  fileName?: string | null;
  assetType?: string | null;
  contentType?: string | null;
  textContent?: string | null;
}) => {
  const base = attachment.fileName || attachment.assetType || attachment.contentType || "Adjunto";
  if (attachment.textContent) {
    return `${base} · ${attachment.textContent}`;
  }
  return base;
};

const toFriendlyElementLabel = (kind?: string | null) => {
  switch ((kind || "").toLowerCase()) {
    case "image":
      return "Imagen";
    case "audio":
      return "Audio";
    case "table":
      return "Tabla";
    case "document":
      return "Documento";
    case "text":
      return "Texto";
    default:
      return "Elemento";
  }
};

const toFriendlyAttachmentType = (
  attachment: {
    assetType?: string | null;
    contentType?: string | null;
  },
) => {
  const normalized = (attachment.assetType || attachment.contentType || "").toLowerCase();
  if (!normalized) {
    return "Adjunto";
  }
  if (normalized.includes("image") || normalized.includes("jpg") || normalized.includes("png") || normalized.includes("webp")) {
    return "Imagen";
  }
  if (normalized.includes("audio") || normalized.includes("voice") || normalized.includes("webm") || normalized.includes("ogg")) {
    return "Audio";
  }
  if (normalized.includes("csv") || normalized.includes("xls")) {
    return "Tabla";
  }
  if (normalized.includes("pdf") || normalized.includes("doc")) {
    return "Documento";
  }
  return attachment.assetType || attachment.contentType || "Adjunto";
};

const resolveAttachmentPreviewUrl = (attachment: {
  content?: string | null;
}) => (typeof attachment.content === "string" && attachment.content.trim() ? attachment.content : null);

type ComposerAttachment = WebchatMessageAttachment & {
  localId: string;
  size: number;
};

const inferAttachmentAssetType = (file: File) => {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf")) return "pdf";
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  ) {
    return "xlsx";
  }
  if (mime.includes("csv") || name.endsWith(".csv")) return "csv";
  if (
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessingml") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    return "docx";
  }
  if (
    mime.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  ) {
    return "text";
  }
  return "file";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No fue posible leer el archivo."));
    reader.readAsDataURL(file);
  });

const buildAttachmentFromFile = async (file: File): Promise<ComposerAttachment> => {
  const assetType = inferAttachmentAssetType(file);
  const [content, textContent] = await Promise.all([
    readFileAsDataUrl(file),
    assetType === "text" || assetType === "csv" ? file.text().catch(() => "") : Promise.resolve(""),
  ]);

  return {
    localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    assetType,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    content,
    textContent: textContent.trim() || undefined,
    metadata: {
      size: file.size,
      lastModified: file.lastModified,
    },
    size: file.size,
  };
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
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [composerError, setComposerError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!nextDraft && composerAttachments.length === 0) {
      return;
    }
    const outgoingAttachments = composerAttachments.map(({ localId, size, ...attachment }) => attachment);
    setDraft("");
    setComposerAttachments([]);
    setComposerError(null);
    await sendMessage({
      text: nextDraft,
      attachments: outgoingAttachments,
    });
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setComposerAttachments((current) =>
      current.filter((attachment) => attachment.localId !== attachmentId),
    );
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) {
      return;
    }

    setComposerError(null);

    if (composerAttachments.length + selected.length > MAX_ATTACHMENTS) {
      setComposerError(`Puedes adjuntar hasta ${MAX_ATTACHMENTS} archivos por mensaje.`);
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      setComposerError(
        `${oversized.name} supera el límite de ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }

    try {
      const built = await Promise.all(selected.map((file) => buildAttachmentFromFile(file)));
      setComposerAttachments((current) => [...current, ...built]);
    } catch (error) {
      console.error(error);
      setComposerError("No fue posible preparar uno de los archivos adjuntos.");
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (!canSend) {
      return;
    }

    formRef.current?.requestSubmit();
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

  const canSend = (Boolean(draft.trim()) || composerAttachments.length > 0) && !isSending && isReady;
  const headerTitle = session?.scope === "customer_authenticated"
    ? "Atención personalizada"
    : "Centro de ayuda";
  const scopeLabel = session?.scope === "customer_authenticated"
    ? "Cliente identificado"
    : "Consulta pública";
  const handoffBanner =
    needsHuman || controlMode === "human"
      ? {
          tone: "human",
          title: "Asesor humano en seguimiento",
          body:
            "Tu consulta ya quedó derivada al equipo. Puedes seguir escribiendo por aquí y el asesor verá el contexto completo.",
        }
      : controlMode === "hybrid"
        ? {
            tone: "hybrid",
            title: "IA + equipo",
            body:
              "El equipo ya tiene contexto de esta conversación. Puedes seguir escribiendo por aquí mientras continuamos el seguimiento.",
          }
        : null;

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
          {handoffBanner ? (
            <div
              className={`${styles.handoffBanner} ${
                handoffBanner.tone === "human" ? styles.handoffBannerHuman : styles.handoffBannerHybrid
              }`}
              data-testid="storefront-webchat-handoff-banner"
            >
              <strong>{handoffBanner.title}</strong>
              <span>{handoffBanner.body}</span>
            </div>
          ) : null}

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
                  Hola. ¿En qué podemos ayudarte hoy?
                </div>
              </div>
            </div>
          ) : null}

          {messages.map((message) => {
            const isCustomer = message.role === "customer";
            const hasMessageText = Boolean(message.text?.trim());
            const nonTextElements = Array.isArray(message.messageElements)
              ? message.messageElements.filter(
                  (element) => element?.kind && element.kind !== "text",
                )
              : [];
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
                        data-testid={`storefront-webchat-attachment-${message.id}-${index}`}
                      >
                        {toFriendlyAttachmentType(attachment) === "Imagen" && resolveAttachmentPreviewUrl(attachment) ? (
                          <a
                            href={resolveAttachmentPreviewUrl(attachment) || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.mediaLink}
                            data-testid={`storefront-webchat-image-${message.id}-${index}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveAttachmentPreviewUrl(attachment) || undefined}
                              alt={attachment.fileName || "Imagen"}
                              className={styles.messageImage}
                            />
                          </a>
                        ) : null}
                        {toFriendlyAttachmentType(attachment) === "Audio" && resolveAttachmentPreviewUrl(attachment) ? (
                          <div
                            className={styles.messageAudio}
                            data-testid={`storefront-webchat-audio-${message.id}-${index}`}
                          >
                            <audio controls src={resolveAttachmentPreviewUrl(attachment) || undefined}>
                              <track kind="captions" />
                              Tu navegador no soporta audio embebido.
                            </audio>
                          </div>
                        ) : null}
                        <div className={styles.fileAttach}>
                          <span className={styles.fileIcon}>
                            {toFriendlyAttachmentType(attachment).slice(0, 1).toUpperCase() || "A"}
                          </span>
                          <div className={styles.fileDetails}>
                            <h6>{attachment.fileName || "Adjunto"}</h6>
                            <span className={styles.fileTypePill}>
                              {toFriendlyAttachmentType(attachment)}
                            </span>
                            <p>{formatAttachmentLabel(attachment)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : null}

                  {hasMessageText ? (
                    <div className={`${styles.messageContent} ${message.pending ? styles.pendingMessage : ""}`}>
                      <div className={styles.messageText}>{message.text}</div>
                      {nonTextElements.length > 0 ? (
                        <div
                          className={styles.elementSummary}
                          data-testid={`storefront-webchat-elements-${message.id}`}
                        >
                          {nonTextElements.map((element, index) => {
                            const label = toFriendlyElementLabel(element.kind);
                            const preview =
                              typeof element.preview === "string"
                                ? element.preview
                                : null;

                            return (
                              <span
                                key={`${message.id}-element-${element.kind ?? "unknown"}-${index}`}
                                className={styles.elementPill}
                              >
                                {label}
                                {preview ? ` · ${preview}` : ""}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : nonTextElements.length > 0 ? (
                    <div
                      className={styles.elementSummary}
                      data-testid={`storefront-webchat-elements-${message.id}`}
                    >
                      {nonTextElements.map((element, index) => {
                        const label = toFriendlyElementLabel(element.kind);
                        const preview =
                          typeof element.preview === "string"
                            ? element.preview
                            : null;

                        return (
                          <span
                            key={`${message.id}-element-${element.kind ?? "unknown"}-${index}`}
                            className={styles.elementPill}
                          >
                            {label}
                            {preview ? ` · ${preview}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

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
        <form ref={formRef} className={styles.footerForm} onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_ATTACHMENT_TYPES}
            className={styles.hiddenInput}
            onChange={handleFilesSelected}
            data-testid="storefront-webchat-file-input"
          />
          {composerAttachments.length > 0 ? (
            <div className={styles.composerAttachments} data-testid="storefront-webchat-composer-attachments">
              {composerAttachments.map((attachment) => (
                <div
                  key={attachment.localId}
                  className={styles.composerAttachment}
                  data-testid={`storefront-webchat-composer-attachment-${attachment.localId}`}
                >
                  <div className={styles.composerAttachmentLabel}>
                    <span className={styles.composerAttachmentType}>
                      {toFriendlyAttachmentType(attachment)}
                    </span>
                    <span>{attachment.fileName || "Adjunto"}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.composerAttachmentRemove}
                    onClick={() => handleRemoveAttachment(attachment.localId)}
                    aria-label={`Quitar ${attachment.fileName || "adjunto"}`}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {composerError ? (
            <div className={styles.composerError} data-testid="storefront-webchat-composer-error">
              {composerError}
            </div>
          ) : null}
          <div className={styles.chatFooterWrap}>
            <div className={styles.formWrap}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                rows={1}
                placeholder="Escribe tu consulta o adjunta archivos"
                className={styles.formControl}
                data-testid="storefront-webchat-input"
              />
            </div>
            <div className={styles.formBtn}>
              <button
                className={styles.attachButton}
                type="button"
                onClick={handleOpenFilePicker}
                data-testid="storefront-webchat-attach"
                aria-label="Adjuntar archivos"
              >
                <IconPaperclip size={16} />
              </button>
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
