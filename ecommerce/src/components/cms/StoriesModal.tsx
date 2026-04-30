"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";

import NextImage from "@/components/NextImage";
import styles from "./CmsPageShell.module.css";

type StoryItem = {
  id: string;
  title: string;
  caption?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  posterUrl?: string | null;
  link?: string | null;
  external?: boolean;
  durationMs: number;
  alt?: string | null;
};

type Props = {
  open: boolean;
  stories: StoryItem[];
  initialIndex: number;
  autoplay: boolean;
  showProgressBar: boolean;
  defaultDurationMs: number;
  onClose: () => void;
};

const clampIndex = (value: number, size: number) => {
  if (!size) return 0;
  return ((value % size) + size) % size;
};

const isExternalUrl = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(href);

export default function StoriesModal({
  open,
  stories,
  initialIndex,
  autoplay,
  showProgressBar,
  defaultDurationMs,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(autoplay ? 0 : 1);

  const activeStory = stories[clampIndex(activeIndex, stories.length)] ?? null;
  const currentDuration = useMemo(() => {
    if (!activeStory) return Math.max(1000, defaultDurationMs);
    return Math.max(1000, activeStory.durationMs || defaultDurationMs);
  }, [activeStory, defaultDurationMs]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(clampIndex(initialIndex, stories.length));
  }, [initialIndex, open, stories.length]);

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
    if (!open || stories.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => clampIndex(current + 1, stories.length));
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => clampIndex(current - 1, stories.length));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, stories.length]);

  useEffect(() => {
    if (!open) return;

    setProgress(autoplay ? 0 : 1);

    if (!autoplay) {
      return;
    }

    let rafId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = Math.min(1, elapsed / currentDuration);
      setProgress(nextProgress);

      if (elapsed >= currentDuration) {
        setActiveIndex((current) => clampIndex(current + 1, stories.length));
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoplay, currentDuration, open, stories.length, activeIndex]);

  if (!mounted || !open || !activeStory) return null;

  const handleNavigate = (direction: "prev" | "next") => {
    setActiveIndex((current) =>
      clampIndex(direction === "next" ? current + 1 : current - 1, stories.length),
    );
    setProgress(autoplay ? 0 : 1);
  };

  const media = activeStory.mediaType === "video" ? (
    <video
      autoPlay={autoplay}
      controls
      muted
      playsInline
      poster={activeStory.posterUrl ?? undefined}
      preload="metadata"
      className={styles.storyModalVideo}>
      <source src={activeStory.mediaUrl} />
    </video>
  ) : (
    <NextImage
      alt={activeStory.alt ?? activeStory.title}
      fill
      priority
      sizes="(max-width: 900px) 100vw, 72vw"
      src={activeStory.mediaUrl}
      className={styles.storyModalImage}
    />
  );

  return createPortal(
    <div className={styles.storyModalOverlay} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={styles.storyModalDialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog">
        <div className={styles.storyModalMediaPane}>
          <div className={styles.storyModalMedia}>{media}</div>

          <button
            aria-label="Historia anterior"
            className={`${styles.storyModalTapZone} ${styles.storyModalTapZoneLeft}`}
            onClick={() => handleNavigate("prev")}
            type="button"
          />
          <button
            aria-label="Siguiente historia"
            className={`${styles.storyModalTapZone} ${styles.storyModalTapZoneRight}`}
            onClick={() => handleNavigate("next")}
            type="button"
          />

          <button
            aria-label="Cerrar historias"
            className={styles.storyModalClose}
            onClick={onClose}
            type="button">
            <IconX size={18} />
          </button>

          {showProgressBar ? (
            <div className={styles.storyModalProgressRail}>
              {stories.map((story, index) => {
                const storyProgress =
                  index < activeIndex ? 1 : index > activeIndex ? 0 : progress;
                return (
                  <div className={styles.storyModalProgressTrack} key={story.id}>
                    <span
                      className={styles.storyModalProgressFill}
                      style={{ width: `${Math.max(0, Math.min(1, storyProgress)) * 100}%` }}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className={styles.storyModalCounter}>
            {activeIndex + 1} / {stories.length}
          </div>
        </div>

        <aside className={styles.storyModalSidePane}>
          <div>
            <p className={styles.storyModalKicker}>Stories</p>
            <h3 className={styles.storyModalTitle}>{activeStory.title}</h3>
            {activeStory.caption ? <p className={styles.storyModalCaption}>{activeStory.caption}</p> : null}
          </div>

          <div className={styles.storyModalList}>
            {stories.map((story, index) => (
              <button
                className={index === activeIndex ? styles.storyModalListItemActive : styles.storyModalListItem}
                key={story.id}
                onClick={() => {
                  setActiveIndex(index);
                  setProgress(autoplay ? 0 : 1);
                }}
                type="button">
                <span className={styles.storyModalListTitle}>{story.title}</span>
                <span className={styles.storyModalListMeta}>
                  {story.mediaType}
                  {" · "}
                  {Math.round(story.durationMs / 1000)}s
                </span>
              </button>
            ))}
          </div>

          {activeStory.link ? (
            isExternalUrl(activeStory.link) || activeStory.external ? (
              <a
                className={styles.storyModalAction}
                href={activeStory.link}
                rel="noreferrer"
                target="_blank">
                Ver historia
              </a>
            ) : (
              <Link className={styles.storyModalAction} href={activeStory.link}>
                Ver historia
              </Link>
            )
          ) : null}

          <div className={styles.storyModalNavRow}>
            <button
              className={styles.storyModalNavButton}
              onClick={() => handleNavigate("prev")}
              type="button">
              <IconChevronLeft size={16} />
              Anterior
            </button>
            <button
              className={styles.storyModalNavButton}
              onClick={() => handleNavigate("next")}
              type="button">
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
