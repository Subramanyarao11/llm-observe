import { initTelemetry } from "@llm-observe/telemetry";

initTelemetry(process.env.OTEL_SERVICE_NAME ?? "llm-observe-worker");
