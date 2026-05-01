"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";

import NextImage from "@/components/NextImage";
import styles from "./CmsPageShell.module.css";

type SocialPostDetailItem = {
  id: string;
  title: string;
  caption?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  kind: string;
  posterUrl?: string | null;
  author: string;
  handle?: string | null;
  avatarUrl?: string | null;
  likes?: string | null;
  comments?: string | null;
  timestamp?: string | null;
  tags: string[];
  link?: string | null;
  external?: boolean;
};

type Props = {
  open: boolean;
  posts: SocialPostDetailItem[];
  initialIndex: number;
  onClose: () => void;
};

const clampIndex = (value: number, size: number) => {
  if (!size) return 0;
  return ((value % size) + size) % size;
};

export default function SocialPostDetailModal({ open, posts, initialIndex, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const updateCompact = () => {
      setIsCompact(window.innerWidth < 768);
    };

    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(clampIndex(initialIndex, posts.length));
  }, [initialIndex, open, posts.length]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || posts.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => clampIndex(current + 1, posts.length));
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => clampIndex(current - 1, posts.length));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, posts.length]);

  if (!mounted || !open || !posts.length) return null;

  const activePost = posts[clampIndex(activeIndex, posts.length)] ?? posts[0];

  const handleNavigate = (direction: "prev" | "next") => {
    setActiveIndex((current) => clampIndex(direction === "next" ? current + 1 : current - 1, posts.length));
  };

  const renderDesktopMedia = () =>
    activePost.mediaType === "video" ? (
      <video
        controls
        muted
        playsInline
        poster={activePost.posterUrl ?? undefined}
        preload="metadata"
        className={styles.socialPostDetailMediaElement}>
        <source src={activePost.mediaUrl} />
      </video>
    ) : (
      <NextImage
        alt={activePost.title}
        fill
        priority
        sizes="(max-width: 900px) 100vw, 70vw"
        src={activePost.mediaUrl}
        className={styles.socialPostDetailMediaElement}
      />
    );

  const renderCompactMedia = () =>
    activePost.mediaType === "video" ? (
      <video
        controls
        muted
        playsInline
        poster={activePost.posterUrl ?? undefined}
        preload="metadata"
        className={styles.socialPostDetailCompactMediaElement}>
        <source src={activePost.mediaUrl} />
      </video>
    ) : (
      <img
        alt={activePost.title}
        className={styles.socialPostDetailCompactMediaElement}
        src={activePost.mediaUrl}
      />
    );

  if (isCompact) {
    return createPortal(
      <div className={styles.socialPostDetailOverlay} onClick={onClose} role="presentation">
        <div
          aria-modal="true"
          className={styles.socialPostDetailCompactDialog}
          onClick={(event) => event.stopPropagation()}
          role="dialog">
          <button
            aria-label="Cerrar detalle"
            className={styles.socialPostDetailClose}
            onClick={onClose}
            type="button">
            <IconX size={18} />
          </button>

          <div className={styles.socialPostDetailCompactMediaPane}>
            <div className={styles.socialPostDetailCompactMedia}>{renderCompactMedia()}</div>
            <div className={styles.socialPostDetailCounter}>
              {activeIndex + 1} / {posts.length}
            </div>
          </div>

          <div className={styles.socialPostDetailCompactSidePane}>
            <div className={styles.socialPostDetailProfileRow}>
              <div className={styles.socialPostDetailAvatar}>
                {activePost.avatarUrl ? (
                  <NextImage
                    alt={activePost.author}
                    className={styles.socialPostDetailAvatarImage}
                    fill
                    sizes="44px"
                    src={activePost.avatarUrl}
                  />
                ) : (
                  <span>{activePost.author.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className={styles.socialPostDetailProfileCopy}>
                <strong>{activePost.author}</strong>
                <span>
                  {activePost.handle}
                  {activePost.timestamp ? ` · ${activePost.timestamp}` : ""}
                </span>
              </div>
            </div>

            <div>
              <p className={styles.socialPostDetailKicker}>Detalle de publicación</p>
              <h3 className={styles.socialPostDetailTitle}>{activePost.title}</h3>
              {activePost.caption ? <p className={styles.socialPostDetailCaption}>{activePost.caption}</p> : null}
            </div>

            <div className={styles.socialPostDetailStats}>
              {activePost.likes ? (
                <div className={styles.socialPostDetailStat}>
                  <strong>{activePost.likes}</strong>
                  <span>Me gusta</span>
                </div>
              ) : null}
              {activePost.comments ? (
                <div className={styles.socialPostDetailStat}>
                  <strong>{activePost.comments}</strong>
                  <span>Comentarios</span>
                </div>
              ) : null}
              <div className={styles.socialPostDetailStat}>
                <strong>{activePost.mediaType === "video" ? "Video" : "Foto"}</strong>
                <span>{activePost.kind}</span>
              </div>
            </div>

            {activePost.tags.length ? (
              <div className={styles.socialPostDetailTags}>
                {activePost.tags.map((tag) => (
                  <span className={styles.socialTag} key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className={styles.socialPostDetailNavRow}>
              <button className={styles.socialPostDetailNavButton} onClick={() => handleNavigate("prev")} type="button">
                <IconChevronLeft size={16} />
                Anterior
              </button>
              <button className={styles.socialPostDetailNavButton} onClick={() => handleNavigate("next")} type="button">
                Siguiente
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className={styles.socialPostDetailOverlay} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={styles.socialPostDetailDialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog">
        <div className={styles.socialPostDetailMediaPane}>
          <div className={styles.socialPostDetailMedia}>{renderDesktopMedia()}</div>

          <button
            aria-label="Publicación anterior"
            className={`${styles.socialPostDetailTapZone} ${styles.socialPostDetailTapZoneLeft}`}
            onClick={() => handleNavigate("prev")}
            type="button"
          />
          <button
            aria-label="Siguiente publicación"
            className={`${styles.socialPostDetailTapZone} ${styles.socialPostDetailTapZoneRight}`}
            onClick={() => handleNavigate("next")}
            type="button"
          />

          <button
            aria-label="Cerrar detalle"
            className={styles.socialPostDetailClose}
            onClick={onClose}
            type="button">
            <IconX size={18} />
          </button>

          <div className={styles.socialPostDetailCounter}>
            {activeIndex + 1} / {posts.length}
          </div>
        </div>

        <aside className={styles.socialPostDetailSidePane}>
          <div className={styles.socialPostDetailProfileRow}>
            <div className={styles.socialPostDetailAvatar}>
              {activePost.avatarUrl ? (
                <NextImage
                  alt={activePost.author}
                  className={styles.socialPostDetailAvatarImage}
                  fill
                  sizes="44px"
                  src={activePost.avatarUrl}
                />
              ) : (
                <span>{activePost.author.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className={styles.socialPostDetailProfileCopy}>
              <strong>{activePost.author}</strong>
              <span>
                {activePost.handle}
                {activePost.timestamp ? ` · ${activePost.timestamp}` : ""}
              </span>
            </div>
          </div>

          <div>
            <p className={styles.socialPostDetailKicker}>Detalle de publicación</p>
            <h3 className={styles.socialPostDetailTitle}>{activePost.title}</h3>
            {activePost.caption ? <p className={styles.socialPostDetailCaption}>{activePost.caption}</p> : null}
          </div>

          <div className={styles.socialPostDetailStats}>
            {activePost.likes ? (
              <div className={styles.socialPostDetailStat}>
                <strong>{activePost.likes}</strong>
                <span>Me gusta</span>
              </div>
            ) : null}
            {activePost.comments ? (
              <div className={styles.socialPostDetailStat}>
                <strong>{activePost.comments}</strong>
                <span>Comentarios</span>
              </div>
            ) : null}
            <div className={styles.socialPostDetailStat}>
              <strong>{activePost.mediaType === "video" ? "Video" : "Foto"}</strong>
              <span>{activePost.kind}</span>
            </div>
          </div>

          {activePost.tags.length ? (
            <div className={styles.socialPostDetailTags}>
              {activePost.tags.map((tag) => (
                <span className={styles.socialTag} key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className={styles.socialPostDetailNavRow}>
            <button className={styles.socialPostDetailNavButton} onClick={() => handleNavigate("prev")} type="button">
              <IconChevronLeft size={16} />
              Anterior
            </button>
            <button className={styles.socialPostDetailNavButton} onClick={() => handleNavigate("next")} type="button">
              Siguiente
              <IconChevronRight size={16} />
            </button>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
