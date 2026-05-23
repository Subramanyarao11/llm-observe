import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useCancelConversation,
  useConversation,
} from "../hooks/queries";
import { useStreamingChat } from "../hooks/useStreamingChat";
import { Provider } from "../lib/api";
import { useChatStore } from "../store/chatStore";

export function ChatView() {
  const { id = "" } = useParams();
  const { data: conversation, isLoading } = useConversation(id);
  const { streamMessage, abortStream } = useStreamingChat();
  const { streamingText, isStreaming } = useChatStore();
  const cancel = useCancelConversation();
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("gpt-4o-mini");

  useEffect(() => {
    if (conversation) {
      setProvider(conversation.provider as Provider);
      setModel(conversation.model);
    }
  }, [conversation?.id, conversation?.provider, conversation?.model]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !id || isStreaming) return;
    streamMessage(id, input.trim(), provider, model);
    setInput("");
  };

  const onCancel = () => {
    abortStream();
    cancel.mutate(id);
  };

  if (isLoading) return <p className="text-slate-400">Loading...</p>;
  if (!conversation)
    return <p className="text-red-400">Conversation not found</p>;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <Link to="/conversations" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back
          </Link>
          <h1 className="text-xl font-bold">{conversation.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            disabled={isStreaming}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isStreaming}
            className="w-48 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
          {conversation.status === "active" && (
            <button
              onClick={onCancel}
              className="rounded border border-red-800 px-3 py-1 text-sm text-red-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {conversation.messages?.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                m.role === "user"
                  ? "bg-emerald-700/40"
                  : "bg-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            </div>
          </div>
        ))}
        {isStreaming && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl bg-slate-800 px-4 py-2">
              <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
              <span className="inline-block h-4 w-1 animate-pulse bg-emerald-400" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming || conversation.status !== "active"}
          placeholder={
            conversation.status !== "active"
              ? "Conversation is not active"
              : "Type a message..."
          }
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || conversation.status !== "active"}
          className="rounded-xl bg-emerald-600 px-6 py-3 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
