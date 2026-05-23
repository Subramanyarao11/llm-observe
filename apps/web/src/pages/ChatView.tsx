import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageContent } from "../components/MessageContent";
import { PageTransition } from "../components/PageTransition";
import { ScrollToBottom } from "../components/ScrollToBottom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  useCancelConversation,
  useConversation,
  useInferenceLogs,
} from "../hooks/queries";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { DEFAULT_MODELS, InferenceLogSummary, Provider } from "../lib/api";
import { useChatStore } from "../store/chatStore";

function getAssistantLog(
  logs: InferenceLogSummary[] | undefined,
  assistantIndex: number,
) {
  if (!logs) return undefined;
  const successful = logs.filter((log) => log.status === "success");
  return successful[assistantIndex];
}

export function ChatView() {
  const { id = "" } = useParams();
  const { data: conversation, isLoading } = useConversation(id);
  const { data: inferenceLogs } = useInferenceLogs(id);
  const { streamMessage, abortStream } = useStreamingChat();
  const { streamingText, isStreaming } = useChatStore();
  const cancel = useCancelConversation();
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversation) {
      setProvider(conversation.provider as Provider);
      setModel(conversation.model);
    }
  }, [conversation?.id, conversation?.provider, conversation?.model]);

  const onProviderChange = (next: Provider) => {
    setProvider(next);
    setModel(DEFAULT_MODELS[next]);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!showScrollButton) scrollToBottom(isStreaming ? "auto" : "smooth");
  }, [conversation?.messages, streamingText, isStreaming, showScrollButton]);

  const assistantIndexByMessageId = useMemo(() => {
    const map = new Map<string, number>();
    let assistantIndex = 0;
    conversation?.messages?.forEach((message) => {
      if (message.role === "assistant") {
        map.set(message.id, assistantIndex);
        assistantIndex += 1;
      }
    });
    return map;
  }, [conversation?.messages]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id || isStreaming) return;
    streamMessage(id, input.trim(), provider, model);
    setInput("");
  };

  const onCancel = () => {
    abortStream();
    cancel.mutate(id, { onSettled: () => setConfirmCancel(false) });
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 120);
  };

  if (isLoading) {
    return <p className="text-neutral-500">Loading conversation...</p>;
  }
  if (!conversation) {
    return <p className="text-red-600 dark:text-red-400">Conversation not found</p>;
  }

  return (
    <PageTransition>
      <div className="relative flex h-[calc(100vh-8rem)] flex-col">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <Link
              to="/conversations"
              className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-semibold">{conversation.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
              disabled={isStreaming}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </Select>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isStreaming}
              className="w-48"
            />
            {conversation.status === "active" ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmCancel(true)}>
                Cancel
              </Button>
            ) : (
              <Badge variant="outline">{conversation.status}</Badge>
            )}
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 space-y-4 overflow-y-auto pr-2"
        >
          {conversation.messages?.map((m) => {
            const log =
              m.role === "assistant"
                ? getAssistantLog(
                    inferenceLogs,
                    assistantIndexByMessageId.get(m.id) ?? 0,
                  )
                : undefined;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    m.role === "user"
                      ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
                  }`}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  ) : (
                    <>
                      <MessageContent content={m.content} />
                      {log ? (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                          {log.latencyMs != null ? (
                            <Badge variant="outline">{log.latencyMs}ms</Badge>
                          ) : null}
                          {log.ttftMs != null ? (
                            <Badge variant="outline">TTFT {log.ttftMs}ms</Badge>
                          ) : null}
                          {log.totalTokens != null ? (
                            <Badge variant="outline">{log.totalTokens} tokens</Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}

          {isStreaming ? (
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                {streamingText ? (
                  <MessageContent content={streamingText} plain />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    Thinking...
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <ScrollToBottom
          visible={showScrollButton}
          onClick={() => {
            setShowScrollButton(false);
            scrollToBottom();
          }}
        />

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming || conversation.status !== "active"}
            placeholder={
              conversation.status !== "active"
                ? "Conversation is not active"
                : "Type a message..."
            }
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isStreaming || conversation.status !== "active"}
            loading={isStreaming}
          >
            {isStreaming ? "Streaming" : "Send"}
          </Button>
        </form>
      </div>

      <Dialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this conversation?"
        description="You can resume it later from the conversations list."
        confirmLabel="Cancel conversation"
        onConfirm={onCancel}
        loading={cancel.isPending}
      />
    </PageTransition>
  );
}
