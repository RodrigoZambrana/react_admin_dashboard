import { useCallback, useState } from "react";
import { createCorrelationId } from "@/lib/http";

export interface CorrelationIdState {
  correlationId: string;
  refresh: () => void;
}

export function useCorrelationId(seed?: string): CorrelationIdState {
  const [correlationId, setCorrelationId] = useState(() => seed ?? createCorrelationId());

  const refresh = useCallback(() => {
    setCorrelationId(createCorrelationId());
  }, []);

  return { correlationId, refresh };
}
