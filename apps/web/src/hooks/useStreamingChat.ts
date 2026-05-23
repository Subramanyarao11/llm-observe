import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Conversation, Provider } from "../lib/api";
import { useChatStore } from "../store/chatStore";

export function useStreamingChat() {
  const qc = useQueryClient();
  const {
    sessionId,
    setActiveStream,
    appendStreamingText,
    resetStreaming,
  } = useChatStore();

  const streamMessage = useCallback(
    (
      conversationId: string,
      content: string,
      provider: Provider,
      model: string,
    ) => {
      resetStreaming();

      qc.setQueryData<Conversation>(["conversations", conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...(old.messages ?? []),
            {
              id: `pending-user-${Date.now()}`,
              role: "user",
              content,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });

      const params = new URLSearchParams({
        conversationId,
        sessionId,
        provider,
        model,
        content,
      });
      const es = new EventSource(`/api/chat/stream?${params}`);
      setActiveStream(es);

      es.onmessage = (e) => {
        const data = JSON.parse(e.data) as {
          chunk?: string;
          done?: boolean;
          error?: boolean;
          message?: string;
        };
        if (data.chunk) appendStreamingText(data.chunk);
        if (data.done || data.error) {
          es.close();
          resetStreaming();
          if (data.error) toast.error(data.message ?? "Streaming failed");
          void qc.invalidateQueries({
            queryKey: ["conversations", conversationId],
          });
          void qc.invalidateQueries({
            queryKey: ["conversations", conversationId, "inference-logs"],
          });
          void qc.invalidateQueries({ queryKey: ["conversations", "list"] });
        }
      };

      es.onerror = () => {
        es.close();
        resetStreaming();
        toast.error("Connection lost while streaming");
        void qc.invalidateQueries({
          queryKey: ["conversations", conversationId],
        });
      };
    },
    [
      sessionId,
      setActiveStream,
      appendStreamingText,
      resetStreaming,
      qc,
    ],
  );

  const abortStream = useCallback(() => {
    const { activeStream } = useChatStore.getState();
    activeStream?.close();
    resetStreaming();
  }, [resetStreaming]);

  return { streamMessage, abortStream, sessionId };
}
