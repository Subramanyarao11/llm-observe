import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, Provider } from "../lib/api";

export function useConversations(filters?: {
  status?: string;
  provider?: Provider;
}) {
  return useQuery({
    queryKey: ["conversations", filters],
    queryFn: () => api.conversations.list(filters),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => api.conversations.get(id),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.conversations.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useCancelConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.conversations.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useResumeConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.conversations.resume,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: api.analytics.summary,
    refetchInterval: 30_000,
  });
}

export function useAnalyticsLatency(window: string) {
  return useQuery({
    queryKey: ["analytics", "latency", window],
    queryFn: () => api.analytics.latency(window),
    refetchInterval: 30_000,
  });
}

export function useAnalyticsThroughput(window: string) {
  return useQuery({
    queryKey: ["analytics", "throughput", window],
    queryFn: () => api.analytics.throughput(window),
    refetchInterval: 30_000,
  });
}

export function useAnalyticsErrors(window: string) {
  return useQuery({
    queryKey: ["analytics", "errors", window],
    queryFn: () => api.analytics.errors(window),
    refetchInterval: 30_000,
  });
}
