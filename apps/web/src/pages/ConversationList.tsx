import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Select } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import {
  useCancelConversation,
  useConversations,
  useResumeConversation,
} from "../hooks/queries";
import { formatRelativeTime, truncate } from "../lib/format";
import { formatApiError } from "../lib/errors";
import { Provider } from "../lib/api";
import { cn } from "../lib/utils";

export function ConversationList() {
  const [status, setStatus] = useState<string>("");
  const [provider, setProvider] = useState<Provider | "">("");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const limit = 10;

  useEffect(() => {
    setPage(1);
  }, [status, provider]);

  const filters = useMemo(
    () => ({
      status: status || undefined,
      provider: provider || undefined,
      page,
      limit,
    }),
    [status, provider, page, limit],
  );
  const { data, isLoading, isError, error, refetch, isFetching } =
    useConversations(filters);
  const cancel = useCancelConversation();
  const resume = useResumeConversation();

  return (
    <PageTransition>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Browse and manage your LLM sessions
          </p>
        </div>
        <Link to="/conversations/new">
          <Button>New Conversation</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-w-[160px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </Select>
        <Select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider | "")}
          className="min-w-[160px]"
        >
          <option value="">All providers</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Gemini</option>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Spinner className="h-4 w-4" />
          Loading conversations...
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load conversations: {formatApiError(error)}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-neutral-500">No conversations yet.</p>
            <Link to="/conversations/new">
              <Button className="mt-4">Start your first chat</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {data?.items.map((c) => {
            const lastMessage = c.messages?.[0];
            const preview = lastMessage
              ? `${lastMessage.role === "user" ? "You" : "Assistant"}: ${truncate(lastMessage.content)}`
              : "No messages yet";

            return (
              <motion.div
                key={c.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <Card
                  className={cn(
                    "transition-shadow hover:shadow-md",
                    c.status === "active" &&
                      "ring-1 ring-neutral-900/10 dark:ring-neutral-100/10",
                  )}
                >
                  <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/conversations/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.title ?? "Untitled"}
                        </Link>
                        <Badge variant={c.status === "active" ? "active" : "outline"}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
                        {preview}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                        <Badge variant="outline">{c.provider}</Badge>
                        <span>{c.model}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(c.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {c.status === "cancelled" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={resume.isPending}
                          onClick={() => resume.mutate(c.id)}
                        >
                          Resume
                        </Button>
                      ) : null}
                      {c.status === "active" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setCancelId(c.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      <Link to={`/conversations/${c.id}`}>
                        <Button variant="outline" size="sm">
                          Open
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {data && data.total > 0 ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {data.totalPages > 1
              ? `Page ${data.page} of ${data.totalPages} · ${data.total} conversations`
              : `${data.total} conversation${data.total === 1 ? "" : "s"}`}
          </p>
          {data.totalPages > 1 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasPrevious || isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasNext || isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title="Cancel conversation?"
        description="This will stop further messages in this conversation. You can resume it later."
        confirmLabel="Cancel conversation"
        onConfirm={() => {
          if (!cancelId) return;
          cancel.mutate(cancelId, {
            onSettled: () => setCancelId(null),
          });
        }}
        loading={cancel.isPending}
      />
    </PageTransition>
  );
}
