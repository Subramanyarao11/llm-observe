import { useState } from "react";
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
import {
  useAnalyticsErrors,
  useAnalyticsLatency,
  useAnalyticsSummary,
  useAnalyticsThroughput,
} from "../hooks/queries";

const COLORS = ["#34d399", "#60a5fa", "#f472b6"];
type Window = "1h" | "24h" | "7d";

export function Dashboard() {
  const [window, setWindow] = useState<Window>("24h");
  const summary = useAnalyticsSummary();
  const latency = useAnalyticsLatency(window);
  const throughput = useAnalyticsThroughput(window);
  const errors = useAnalyticsErrors(window);

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
      if (!acc[row.hour]) {
        acc[row.hour] = { hour: row.hour, openai: 0, anthropic: 0, gemini: 0 };
      }
      acc[row.hour][row.provider as "openai" | "anthropic" | "gemini"] = row.count;
      return acc;
    }, {}) ?? {};

  const throughputData = Object.values(throughputChart);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <select
          value={window}
          onChange={(e) => setWindow(e.target.value as Window)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="1h">Last 1 hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: "Total Requests",
            value: summary.data?.totalRequests ?? 0,
          },
          {
            label: "Avg Latency",
            value: `${Math.round(summary.data?.avgLatencyMs ?? 0)}ms`,
          },
          {
            label: "Success Rate",
            value: `${Math.round((summary.data?.successRate ?? 0) * 100)}%`,
          },
          {
            label: "Total Tokens",
            value: summary.data?.totalTokens ?? 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Latency by Provider">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={latencyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="provider" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              <Line type="monotone" dataKey="latency" stroke="#34d399" name="Latency (ms)" />
              <Line type="monotone" dataKey="ttft" stroke="#60a5fa" name="TTFT (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Throughput">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" tickFormatter={(v) => v.slice(11)} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              <Bar dataKey="openai" stackId="a" fill={COLORS[0]} />
              <Bar dataKey="anthropic" stackId="a" fill={COLORS[1]} />
              <Bar dataKey="gemini" stackId="a" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Errors">
          <div className="mb-4 text-sm text-slate-400">
            Error rate: {Math.round((errors.data?.errorRate ?? 0) * 100)}% (
            {errors.data?.totalErrors ?? 0} errors)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="pb-2">Error Code</th>
                <th className="pb-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {errors.data?.byCode.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-2">{row.errorCode ?? "UNKNOWN"}</td>
                  <td className="py-2">{row._count}</td>
                </tr>
              ))}
              {(errors.data?.byCode.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-slate-500">
                    No errors in this window
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Errors by Provider">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={
                errors.data?.byProvider.map((r) => ({
                  provider: r.provider,
                  count: r._count,
                })) ?? []
              }
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="provider" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
              <Bar dataKey="count">
                {errors.data?.byProvider.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  );
}
