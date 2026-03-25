"use client";

import { FormEvent, useState } from "react";

import { useWebchat } from "@/state/webchat-context";

export default function WebchatDrawer() {
  const { isOpen, close, messages, sendMessage, isSending, error } = useWebchat();
  const [draft, setDraft] = useState("");

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextDraft = draft;
    setDraft("");
    await sendMessage(nextDraft);
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-[70] flex h-[70vh] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      data-testid="storefront-webchat-drawer"
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-semibold">Asistente</div>
          <div className="text-xs text-slate-300">Consultas y orientación comercial</div>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-full border border-white/20 px-3 py-1 text-xs"
          data-testid="storefront-webchat-close"
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4" data-testid="storefront-webchat-messages">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
            Escribe tu consulta para iniciar la conversación.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.role === "customer"
                  ? "ml-6 bg-slate-900 text-white"
                  : "mr-6 border border-slate-200 bg-white text-slate-700"
              }`}
              data-testid={`storefront-webchat-message-${message.role}`}
            >
              {message.text}
            </div>
          ))
        )}
        {error ? (
          <div className="text-sm text-red-500" data-testid="storefront-webchat-error">
            {error}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Escribe tu mensaje"
            className="min-h-[64px] flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900"
            data-testid="storefront-webchat-input"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="storefront-webchat-send"
          >
            {isSending ? "Enviando" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
