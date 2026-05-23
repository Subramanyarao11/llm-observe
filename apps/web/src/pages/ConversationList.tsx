import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCancelConversation,
  useConversations,
  useResumeConversation,
} from "../hooks/queries";
import { Provider } from "../lib/api";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  cancelled: "bg-red-500/20 text-red-300",
  completed: "bg-slate-500/20 text-slate-300",
};

export function ConversationList() {
  const [status, setStatus] = useState<string>("");
  const [provider, setProvider] = useState<Provider | "">("");
  const { data, isLoading } = useConversations({
    status: status || undefined,
    provider: provider || undefined,
  });
  const cancel = useCancelConversation();
  const resume = useResumeConversation();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <Link
          to="/conversations/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
        >
          New Conversation
        </Link>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider | "")}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="">All providers</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Gemini</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-3">
          {data?.items.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div>
                <Link
                  to={`/conversations/${c.id}`}
                  className="font-medium hover:text-emerald-400"
                >
                  {c.title ?? "Untitled"}
                </Link>
                <div className="mt-1 flex gap-2 text-xs text-slate-400">
                  <span className="rounded bg-slate-800 px-2 py-0.5">
                    {c.provider}
                  </span>
                  <span>{c.model}</span>
                  <span
                    className={`rounded px-2 py-0.5 ${statusColors[c.status] ?? ""}`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {c.status === "cancelled" && (
                  <button
                    onClick={() => resume.mutate(c.id)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
                  >
                    Resume
                  </button>
                )}
                {c.status === "active" && (
                  <button
                    onClick={() => cancel.mutate(c.id)}
                    className="rounded-lg border border-red-800 px-3 py-1 text-sm text-red-300 hover:bg-red-950"
                  >
                    Cancel
                  </button>
                )}
                <Link
                  to={`/conversations/${c.id}`}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
          {data?.items.length === 0 && (
            <p className="text-slate-500">No conversations yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
