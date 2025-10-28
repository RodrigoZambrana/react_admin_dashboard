"use client";

import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/state/session-context";

const formatTime = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return `${timestamp}`;
  }
};

export const GoogleAuthDebugPanel: React.FC = () => {
  const { googleAuthDebug } = useSession();
  const { isEnabled, events, clear } = googleAuthDebug;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (events.length > 0) {
      setIsExpanded(true);
    }
  }, [events.length]);

  const latestTimestamp = useMemo(() => {
    return events.length ? events[events.length - 1].timestamp : null;
  }, [events]);

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex flex-col items-end gap-2 text-white">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="pointer-events-auto rounded-full bg-gray-900/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md backdrop-blur transition hover:bg-gray-800"
      >
        {isExpanded ? "Ocultar depurador Google" : "Mostrar depurador Google"} ({events.length})
      </button>

      {isExpanded ? (
        <div className="pointer-events-auto w-80 max-w-[90vw] rounded-lg border border-white/10 bg-gray-900/95 p-3 text-xs shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Eventos de Google Auth</span>
              {latestTimestamp ? (
                <span className="text-[0.65rem] text-white/70">
                  Último evento: {formatTime(latestTimestamp)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded border border-white/30 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-white/80 transition hover:border-white hover:text-white"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="rounded border border-transparent px-2 py-1 text-[0.65rem] text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <p className="text-[0.7rem] text-white/70">Sin eventos registrados todavía.</p>
            ) : (
              events
                .slice()
                .reverse()
                .map((event) => (
                  <div key={event.id} className="rounded border border-white/10 bg-white/5 p-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[0.75rem] font-semibold">{event.label}</span>
                      <span className="text-[0.65rem] text-white/70">{formatTime(event.timestamp)}</span>
                    </div>
                    {event.details ? (
                      <pre className="mt-1 whitespace-pre-wrap break-words text-[0.7rem] text-white/80">
                        {event.details}
                      </pre>
                    ) : null}
                  </div>
                ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GoogleAuthDebugPanel;
