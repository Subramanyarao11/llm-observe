export interface ApiErrorBody {
  code: string;
  message: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function parseApiError(status: number, body: string): ApiError {
  try {
    const parsed = JSON.parse(body) as Partial<ApiErrorBody>;
    if (parsed.code && parsed.message) {
      return new ApiError(status, parsed.code, parsed.message);
    }
  } catch {
    // fall through
  }

  return new ApiError(
    status,
    status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
    body || "Request failed",
  );
}

export function formatApiError(error: unknown): string {
  if (isApiError(error)) {
    return `${error.message} (${error.code})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}
