import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Provider } from "../lib/api";
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
          qc.invalidateQueries({ queryKey: ["conversations", conversationId] });
        }
      };

      es.onerror = () => {
        es.close();
        resetStreaming();
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
