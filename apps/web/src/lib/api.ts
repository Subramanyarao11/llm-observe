const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
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

export const api = {
  conversations: {
    list: (filters?: { status?: string; provider?: Provider }) => {
      const params = new URLSearchParams(filters as Record<string, string>);
      return request<{ items: Conversation[]; total: number }>(
        `/conversations?${params}`,
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
  },
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini: "gemini-1.5-flash",
};
