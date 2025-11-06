import type { ApiError } from "@/lib/http";

type ErrorDetailsWithMessage = { message?: unknown };

export const extractApiErrorMessage = (error: ApiError): string => {
  const details = error.details;
  if (details && typeof details === "object" && "message" in details) {
    const candidate = String((details as ErrorDetailsWithMessage).message ?? "").trim();
    if (candidate) {
      return candidate;
    }
  }
  return error.message;
};
