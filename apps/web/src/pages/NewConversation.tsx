import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTransition } from "../components/PageTransition";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
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
    const conv = await create.mutateAsync({
      provider,
      model,
      title: title || undefined,
    });
    navigate(`/conversations/${conv.id}`);
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          New Conversation
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Choose a provider and model to start observing inference logs.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <Select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
              className="w-full"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Model</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </div>
    </PageTransition>
  );
}
