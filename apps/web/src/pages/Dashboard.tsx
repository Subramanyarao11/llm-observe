import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "../components/PageTransition";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import {
  useAnalyticsErrors,
  useAnalyticsLatency,
  useAnalyticsLogs,
  useAnalyticsSummary,
  useAnalyticsThroughput,
  useRecentErrors,
} from "../hooks/queries";
import { downloadCsv } from "../lib/csv";
import { formatRelativeTime } from "../lib/format";
import { api } from "../lib/api";

const CHART_COLORS = ["#171717", "#525252", "#737373"];
type Window = "1h" | "24h" | "7d";

export function Dashboard() {
  const [window, setWindow] = useState<Window>("24h");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [hourFilter, setHourFilter] = useState<string | null>(null);

  const summary = useAnalyticsSummary();
  const latency = useAnalyticsLatency(window);
  const throughput = useAnalyticsThroughput(window);
  const errors = useAnalyticsErrors(window);
  const recentErrors = useRecentErrors(window);
  const filteredLogs = useAnalyticsLogs(
    window,
    providerFilter ?? undefined,
    hourFilter ?? undefined,
  );

  const latencyChart =
    latency.data?.map((r) => ({
      provider: r.provider,
      latency: Math.round(r._avg.latencyMs ?? 0),
      ttft: Math.round(r._avg.ttftMs ?? 0),
    })) ?? [];

  const throughputChart =
    throughput.data?.reduce<
      Record<string, { hour: string; openai: number; anthropic: number; gemini: number }>
    >((acc, row) => {
      if (providerFilter && row.provider !== providerFilter) return acc;
      if (hourFilter && !row.hour.startsWith(hourFilter)) return acc;
      if (!acc[row.hour]) {
        acc[row.hour] = { hour: row.hour, openai: 0, anthropic: 0, gemini: 0 };
      }
      acc[row.hour][row.provider as "openai" | "anthropic" | "gemini"] = row.count;
      return acc;
    }, {}) ?? {};

  const throughputData = Object.values(throughputChart);

  const handleExport = async () => {
    try {
      const logs = await api.analytics.logs(
        window,
        providerFilter ?? undefined,
        hourFilter ?? undefined,
      );
      if (logs.length === 0) {
        toast.error("No logs available to export for the current filters");
        return;
      }
      downloadCsv(
        `analytics-${window}${providerFilter ? `-${providerFilter}` : ""}.csv`,
        logs as unknown as Record<string, unknown>[],
      );
      toast.success("CSV exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  return (
    <PageTransition>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Monitor latency, throughput, and errors across providers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={window}
            onChange={(e) => setWindow(e.target.value as Window)}
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {(providerFilter || hourFilter) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">Active filters:</span>
          {providerFilter ? <Badge variant="outline">Provider: {providerFilter}</Badge> : null}
          {hourFilter ? <Badge variant="outline">Hour: {hourFilter}</Badge> : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProviderFilter(null);
              setHourFilter(null);
            }}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Requests", value: summary.data?.totalRequests ?? 0 },
          {
            label: "Avg Latency",
            value: `${Math.round(summary.data?.avgLatencyMs ?? 0)}ms`,
          },
          {
            label: "Success Rate",
            value: `${Math.round((summary.data?.successRate ?? 0) * 100)}%`,
          },
          { label: "Total Tokens", value: summary.data?.totalTokens ?? 0 },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              <p className="text-sm text-neutral-500">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latency by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={latencyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="provider" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#171717"
                  name="Latency (ms)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ttft"
                  stroke="#737373"
                  name="TTFT (ms)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Throughput</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="hour" tickFormatter={(v) => v.slice(11)} />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="openai"
                  stackId="a"
                  fill={CHART_COLORS[0]}
                  onClick={(data) => {
                    const payload = data as { hour?: string };
                    if (payload.hour) {
                      setHourFilter(payload.hour);
                      setProviderFilter("openai");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
                <Bar
                  dataKey="anthropic"
                  stackId="a"
                  fill={CHART_COLORS[1]}
                  onClick={(data) => {
                    const payload = data as { hour?: string };
                    if (payload.hour) {
                      setHourFilter(payload.hour);
                      setProviderFilter("anthropic");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
                <Bar
                  dataKey="gemini"
                  stackId="a"
                  fill={CHART_COLORS[2]}
                  onClick={(data) => {
                    const payload = data as { hour?: string };
                    if (payload.hour) {
                      setHourFilter(payload.hour);
                      setProviderFilter("gemini");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-sm text-neutral-500">
              Error rate: {Math.round((errors.data?.errorRate ?? 0) * 100)}% (
              {errors.data?.totalErrors ?? 0} errors)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Provider</th>
                    <th className="pb-2">When</th>
                    <th className="pb-2">Conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {recentErrors.data?.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-neutral-100 dark:border-neutral-900"
                    >
                      <td className="py-2">{row.errorCode ?? "UNKNOWN"}</td>
                      <td className="py-2">{row.provider}</td>
                      <td className="py-2">{formatRelativeTime(row.createdAt)}</td>
                      <td className="py-2">
                        {row.conversationId ? (
                          <Link
                            to={`/conversations/${row.conversationId}`}
                            className="underline underline-offset-2"
                          >
                            Open
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {(recentErrors.data?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-neutral-500">
                        No errors in this window
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Errors by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={
                  errors.data?.byProvider.map((r) => ({
                    provider: r.provider,
                    count: r._count,
                  })) ?? []
                }
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
                <XAxis dataKey="provider" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="count"
                  onClick={(data) => {
                    const payload = data as { provider?: string };
                    if (payload.provider) setProviderFilter(payload.provider);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {errors.data?.byProvider.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {filteredLogs.data && filteredLogs.data.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Filtered Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-neutral-500">
              Showing {filteredLogs.data.length} matching inference logs
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                    <th className="pb-2">Provider</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Latency</th>
                    <th className="pb-2">Tokens</th>
                    <th className="pb-2">Conversation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.data.slice(0, 10).map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-neutral-100 dark:border-neutral-900"
                    >
                      <td className="py-2">{log.provider}</td>
                      <td className="py-2">{log.status}</td>
                      <td className="py-2">{log.latencyMs ?? "—"}ms</td>
                      <td className="py-2">{log.totalTokens ?? "—"}</td>
                      <td className="py-2">
                        {log.conversationId ? (
                          <Link
                            to={`/conversations/${log.conversationId}`}
                            className="underline underline-offset-2"
                          >
                            Open
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageTransition>
  );
}
