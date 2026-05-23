import { parseApiError } from "./errors";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw parseApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

export type Provider = "openai" | "anthropic" | "gemini";

export interface Conversation {
  id: string;
  title: string | null;
  provider: Provider;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface InferenceLogSummary {
  id: string;
  latencyMs: number | null;
  ttftMs: number | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  status: string;
  requestStartedAt: string;
}

export interface RecentError {
  id: string;
  errorCode: string | null;
  errorMessage: string | null;
  conversationId: string | null;
  provider: string;
  model: string;
  createdAt: string;
}

export interface AnalyticsLog {
  id: string;
  conversationId: string | null;
  sessionId: string;
  provider: string;
  model: string;
  status: string;
  latencyMs: number | null;
  ttftMs: number | null;
  totalTokens: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  errorCode: string | null;
  createdAt: string;
}

export interface PaginatedConversations {
  items: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const api = {
  conversations: {
    list: (filters?: {
      status?: string;
      provider?: Provider;
      page?: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.provider) params.set("provider", filters.provider);
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      const query = params.toString();
      return request<PaginatedConversations>(
        `/conversations${query ? `?${query}` : ""}`,
      );
    },
    get: (id: string) => request<Conversation>(`/conversations/${id}`),
    create: (data: { provider: Provider; model: string; title?: string }) =>
      request<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    cancel: (id: string) =>
      request<Conversation>(`/conversations/${id}/cancel`, { method: "PATCH" }),
    resume: (id: string) =>
      request<Conversation>(`/conversations/${id}/resume`, { method: "POST" }),
    inferenceLogs: (id: string) =>
      request<InferenceLogSummary[]>(`/conversations/${id}/inference-logs`),
  },
  analytics: {
    summary: () =>
      request<{
        totalRequests: number;
        avgLatencyMs: number;
        successRate: number;
        totalTokens: number;
      }>("/analytics/summary"),
    latency: (window: string) =>
      request<
        {
          provider: string;
          _avg: { latencyMs: number | null; ttftMs: number | null };
          _count: number;
        }[]
      >(`/analytics/latency?window=${window}`),
    throughput: (window: string) =>
      request<
        { hour: string; provider: string; count: number; tokens: number }[]
      >(`/analytics/throughput?window=${window}`),
    errors: (window: string) =>
      request<{
        errorRate: number;
        totalErrors: number;
        byCode: { errorCode: string | null; _count: number }[];
        byProvider: { provider: string; _count: number }[];
      }>(`/analytics/errors?window=${window}`),
    recentErrors: (window: string) =>
      request<RecentError[]>(`/analytics/recent-errors?window=${window}`),
    logs: (window: string, provider?: string, hour?: string) => {
      const params = new URLSearchParams({ window });
      if (provider) params.set("provider", provider);
      if (hour) params.set("hour", hour);
      return request<AnalyticsLog[]>(`/analytics/logs?${params}`);
    },
  },
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini: "gemini-1.5-flash",
};
