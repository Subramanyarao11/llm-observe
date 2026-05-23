import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateConversation } from "../hooks/queries";
import { DEFAULT_MODELS, Provider } from "../lib/api";

export function NewConversation() {
  const navigate = useNavigate();
  const create = useCreateConversation();
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [title, setTitle] = useState("");

  const onProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const conv = await create.mutateAsync({ provider, model, title: title || undefined });
    navigate(`/conversations/${conv.id}`);
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">New Conversation</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="Optional title"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Provider</label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as Provider)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400">Model</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {create.isPending ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
