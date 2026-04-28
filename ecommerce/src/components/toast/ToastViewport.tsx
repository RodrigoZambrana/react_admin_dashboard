"use client";

import { memo, useCallback, type ReactNode } from "react";
import styled from "styled-components";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconBellRinging,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";

import type { ToastMessage, ToastVariant } from "@/contexts/ToastContext";
import type { ThemeOption } from "@/theme/type";

type AppTheme = ThemeOption;

const iconMap: Record<ToastVariant, ReactNode> = {
  success: <IconCircleCheck size={20} stroke={1.8} />,
  error: <IconAlertTriangle size={20} stroke={1.8} />,
  info: <IconInfoCircle size={20} stroke={1.8} />,
  warning: <IconBellRinging size={20} stroke={1.8} />,
};

const toastPalette: Record<
  ToastVariant,
  { accent: (theme: AppTheme) => string; subtle: (theme: AppTheme) => string }
> = {
  success: {
    accent: (theme) => theme.colors.success.main,
    subtle: (theme) => theme.colors.success.light,
  },
  error: {
    accent: (theme) => theme.colors.error.main,
    subtle: (theme) => theme.colors.error.light,
  },
  info: {
    accent: (theme) => theme.colors.blue.main,
    subtle: (theme) => theme.colors.blue[100],
  },
  warning: {
    accent: (theme) => theme.colors.warn.main,
    subtle: (theme) => `${theme.colors.warn.main}22`,
  },
};

const Viewport = styled.div`
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: min(420px, calc(100vw - 1rem));
  pointer-events: none;

  @media (max-width: 768px) {
    left: 0.75rem;
    right: 0.75rem;
    top: 1rem;
    margin: 0 auto;
    align-items: center;
  }
`;

const ToastCard = styled(motion.article)<{ $variant: ToastVariant }>`
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.body.paper};
  color: ${({ theme }) => theme.colors.text.primary};
  border-radius: 12px;
  box-shadow: ${({ theme }) => theme.shadows.regular};
  border-left: 4px solid ${({ $variant, theme }) => toastPalette[$variant].accent(theme)};
  padding: 0.9rem 1rem 0.9rem 0.95rem;
`;

const IconWrapper = styled.span<{ $variant: ToastVariant }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  background-color: ${({ $variant, theme }) => toastPalette[$variant].subtle(theme)};
  color: ${({ $variant, theme }) => toastPalette[$variant].accent(theme)};
  flex-shrink: 0;
`;

const Title = styled.h6`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.gray[900]};
`;

const Description = styled.p`
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.gray[700]};
  white-space: pre-line;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const ActionButton = styled.button<{ $variant: ToastVariant }>`
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background-color: ${({ $variant, theme }) => toastPalette[$variant].accent(theme)};
  color: ${({ theme }) => theme.colors.gray.white};
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(0.95);
  }

  &:active {
    transform: translateY(0);
    filter: brightness(0.9);
  }
`;

const CloseButton = styled.button`
  margin-left: auto;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.gray[500]};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.gray[200]};
    color: ${({ theme }) => theme.colors.gray[800]};
  }
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
`;

const ToastMessageCard = memo(function ToastMessageCard({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const handleAction = useCallback(() => {
    message.action?.onClick?.();
    if (message.action?.closeOnClick !== false) {
      onDismiss(message.id);
    }
  }, [message, onDismiss]);

  const hasDescription = Boolean(message.description);

  return (
    <ToastCard
      layout
      $variant={message.type}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <IconWrapper $variant={message.type}>{iconMap[message.type]}</IconWrapper>

      <Content>
        {message.title ? <Title>{message.title}</Title> : null}
        {hasDescription ? <Description>{message.description}</Description> : null}
        {message.action ? (
          <Actions>
            <ActionButton type="button" $variant={message.type} onClick={handleAction}>
              {message.action.label}
            </ActionButton>
          </Actions>
        ) : null}
      </Content>

      <CloseButton
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => onDismiss(message.id)}
      >
        <IconX size={16} stroke={1.8} />
      </CloseButton>
    </ToastCard>
  );
});

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastViewport = memo(function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <Viewport role="region" aria-live="polite" aria-relevant="additions removals">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastMessageCard key={toast.id} message={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </Viewport>
  );
});

export default ToastViewport;
