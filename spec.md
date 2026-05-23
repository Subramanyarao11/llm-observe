# LLM Inference Logging & Ingestion System — Full Spec

> Stack: React + NestJS (Fastify) · Turborepo monorepo · BullMQ + Redis · PostgreSQL + Prisma · Docker Compose · k8s manifests

---

## 0. Repo Structure

```
llm-observe/
├── apps/
│   ├── web/                  # React + Vite frontend
│   ├── api/                  # NestJS API server
│   └── worker/               # BullMQ log consumer (separate process)
├── packages/
│   ├── sdk/                  # LLM wrapper / interceptor (shared lib)
│   ├── db/                   # Prisma schema + generated client (shared)
│   ├── pii/                  # PII redaction lib (shared)
│   └── types/                # Shared TypeScript types & Zod schemas
├── k8s/                      # Kubernetes manifests
├── docker-compose.yml
├── turbo.json
└── package.json              # Root workspace (pnpm)
```

Package manager: **pnpm workspaces**. All apps reference shared packages via workspace protocol (`"@llm-observe/sdk": "workspace:*"`).

---

## 1. Docker Compose (one-command setup)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: llmobserve
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/llmobserve
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile   # same base image, different CMD
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/llmobserve
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      VITE_API_URL: http://localhost:3001
    ports:
      - "5173:80"
    depends_on:
      - api

volumes:
  pgdata:
```

Run with: `docker compose up --build`

---

## 2. Database Schema (`packages/db/prisma/schema.prisma`)

### Design decisions
- Conversations are top-level entities; messages belong to a conversation.
- `inference_logs` is the append-only audit table — one row per LLM call.
- `input_preview` / `output_preview` store truncated, PII-redacted text only (max 500 chars).
- `metadata` is a JSON column for provider-specific extras (finish reason, model version, etc.).
- All timestamp columns are `timestamptz` (UTC).
- Indexes on `(created_at, provider, status)` for dashboard aggregation queries.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Conversation {
  id           String    @id @default(uuid())
  title        String?
  provider     String    // "openai" | "anthropic" | "gemini"
  model        String
  status       String    @default("active") // "active" | "cancelled" | "completed"
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  messages     Message[]
  inferenceLogs InferenceLog[]

  @@index([status, createdAt])
  @@map("conversations")
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  role           String       // "user" | "assistant" | "system"
  content        String       // full content (PII redacted before insert)
  tokenCount     Int?
  createdAt      DateTime     @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@map("messages")
}

model InferenceLog {
  id               String       @id @default(uuid())
  conversationId   String?
  sessionId        String       // client-generated UUID per browser session
  provider         String       // "openai" | "anthropic" | "gemini"
  model            String
  status           String       // "success" | "error" | "streaming"
  
  // Latency
  requestStartedAt  DateTime
  firstTokenAt      DateTime?   // for streaming: time to first token
  requestEndedAt    DateTime?
  latencyMs         Int?        // total request duration
  ttftMs            Int?        // time to first token ms

  // Token usage
  promptTokens      Int?
  completionTokens  Int?
  totalTokens       Int?

  // Previews (truncated, PII-redacted)
  inputPreview      String?     @db.VarChar(500)
  outputPreview     String?     @db.VarChar(500)

  // Error info
  errorCode         String?
  errorMessage      String?     @db.VarChar(500)

  // Extras
  metadata          Json?       // finish_reason, model version, etc.
  piiRedacted       Boolean     @default(false)

  createdAt         DateTime    @default(now())

  conversation      Conversation? @relation(fields: [conversationId], references: [id])

  @@index([createdAt])
  @@index([provider, createdAt])
  @@index([status, createdAt])
  @@index([sessionId, createdAt])
  @@map("inference_logs")
}
```

---

## 3. Shared Types (`packages/types`)

```typescript
// packages/types/src/index.ts

export type Provider = "openai" | "anthropic" | "gemini";

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMRequestOptions {
  provider: Provider;
  model: string;
  messages: LLMMessage[];
  stream?: boolean;
  conversationId?: string;
  sessionId: string;
}

export interface InferenceMetadata {
  logId: string;
  conversationId?: string;
  sessionId: string;
  provider: Provider;
  model: string;
  requestStartedAt: string;         // ISO
  firstTokenAt?: string;
  requestEndedAt?: string;
  latencyMs?: number;
  ttftMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  status: "success" | "error" | "streaming";
  inputPreview?: string;
  outputPreview?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// Zod schema (used by ingestion endpoint for validation)
import { z } from "zod";

export const InferenceLogPayloadSchema = z.object({
  logId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string().min(1),
  requestStartedAt: z.string().datetime(),
  firstTokenAt: z.string().datetime().optional(),
  requestEndedAt: z.string().datetime().optional(),
  latencyMs: z.number().int().nonneg().optional(),
  ttftMs: z.number().int().nonneg().optional(),
  promptTokens: z.number().int().nonneg().optional(),
  completionTokens: z.number().int().nonneg().optional(),
  totalTokens: z.number().int().nonneg().optional(),
  status: z.enum(["success", "error", "streaming"]),
  inputPreview: z.string().max(500).optional(),
  outputPreview: z.string().max(500).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type InferenceLogPayload = z.infer<typeof InferenceLogPayloadSchema>;
```

---

## 4. PII Redaction (`packages/pii`)

```typescript
// packages/pii/src/index.ts

const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  { name: "email",       pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,          replacement: "[EMAIL]"  },
  { name: "phone_us",    pattern: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g,           replacement: "[PHONE]"  },
  { name: "ssn",         pattern: /\b\d{3}-\d{2}-\d{4}\b/g,                                     replacement: "[SSN]"    },
  { name: "credit_card", pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,                              replacement: "[CARD]"   },
  { name: "ip_address",  pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                              replacement: "[IP]"     },
  { name: "api_key",     pattern: /\b(sk-|pk-|ak-)[a-zA-Z0-9]{20,}\b/g,                        replacement: "[APIKEY]" },
];

export function redactPII(text: string): { redacted: string; didRedact: boolean } {
  let redacted = text;
  let didRedact = false;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const original = redacted;
    redacted = redacted.replace(pattern, replacement);
    if (redacted !== original) didRedact = true;
  }

  return { redacted, didRedact };
}
```

---

## 5. LLM SDK Wrapper (`packages/sdk`)

The SDK is a class that wraps provider clients. It:
1. Captures request metadata before the call
2. Streams or awaits the response
3. Emits a log payload to the ingestion endpoint (fire-and-forget, non-blocking)

```typescript
// packages/sdk/src/LLMClient.ts

import { v4 as uuid } from "uuid";
import type { LLMRequestOptions, InferenceMetadata, Provider } from "@llm-observe/types";
import { OpenAIAdapter } from "./adapters/openai";
import { AnthropicAdapter } from "./adapters/anthropic";
import { GeminiAdapter } from "./adapters/gemini";

export interface LLMAdapter {
  chat(options: LLMRequestOptions): Promise<{ content: string; usage?: TokenUsage }>;
  stream(options: LLMRequestOptions): AsyncGenerator<string>;
}

interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

interface SDKConfig {
  ingestUrl: string;          // e.g. http://api:3001/ingest
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
}

export class LLMClient {
  private adapters: Record<Provider, LLMAdapter>;
  private ingestUrl: string;

  constructor(config: SDKConfig) {
    this.ingestUrl = config.ingestUrl;
    this.adapters = {
      openai:    new OpenAIAdapter(config.openaiApiKey!),
      anthropic: new AnthropicAdapter(config.anthropicApiKey!),
      gemini:    new GeminiAdapter(config.geminiApiKey!),
    };
  }

  async chat(options: LLMRequestOptions): Promise<string> {
    const logId = uuid();
    const requestStartedAt = new Date().toISOString();
    let status: InferenceMetadata["status"] = "success";
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    let result: { content: string; usage?: TokenUsage } = { content: "" };

    try {
      result = await this.adapters[options.provider].chat(options);
    } catch (err: any) {
      status = "error";
      errorCode = err.code ?? "UNKNOWN";
      errorMessage = err.message?.slice(0, 500);
      throw err;
    } finally {
      const requestEndedAt = new Date().toISOString();
      const latencyMs = Date.now() - new Date(requestStartedAt).getTime();
      const inputPreview = options.messages.at(-1)?.content.slice(0, 500);
      const outputPreview = result.content.slice(0, 500);

      this.emitLog({
        logId,
        conversationId: options.conversationId,
        sessionId: options.sessionId,
        provider: options.provider,
        model: options.model,
        requestStartedAt,
        requestEndedAt,
        latencyMs,
        status,
        inputPreview,
        outputPreview,
        errorCode,
        errorMessage,
        ...result.usage,
      });
    }

    return result.content;
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<string> {
    const logId = uuid();
    const requestStartedAt = new Date().toISOString();
    let firstTokenAt: string | undefined;
    let fullOutput = "";
    let status: InferenceMetadata["status"] = "success";
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      for await (const chunk of this.adapters[options.provider].stream(options)) {
        if (!firstTokenAt) firstTokenAt = new Date().toISOString();
        fullOutput += chunk;
        yield chunk;
      }
    } catch (err: any) {
      status = "error";
      errorCode = err.code ?? "UNKNOWN";
      errorMessage = err.message?.slice(0, 500);
      throw err;
    } finally {
      const requestEndedAt = new Date().toISOString();
      const latencyMs = Date.now() - new Date(requestStartedAt).getTime();
      const ttftMs = firstTokenAt
        ? new Date(firstTokenAt).getTime() - new Date(requestStartedAt).getTime()
        : undefined;

      this.emitLog({
        logId,
        conversationId: options.conversationId,
        sessionId: options.sessionId,
        provider: options.provider,
        model: options.model,
        requestStartedAt,
        firstTokenAt,
        requestEndedAt,
        latencyMs,
        ttftMs,
        status,
        inputPreview: options.messages.at(-1)?.content.slice(0, 500),
        outputPreview: fullOutput.slice(0, 500),
        errorCode,
        errorMessage,
      });
    }
  }

  // Fire-and-forget — never blocks the LLM response
  private emitLog(payload: Partial<InferenceMetadata> & { logId: string }): void {
    fetch(`${this.ingestUrl}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent fail — log ingestion must never crash the chat
    });
  }
}
```

### Provider Adapters

Each adapter implements `LLMAdapter`. Sketch for all three:

```typescript
// packages/sdk/src/adapters/openai.ts
import OpenAI from "openai";
import type { LLMAdapter, LLMRequestOptions } from "../LLMClient";

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  constructor(apiKey: string) { this.client = new OpenAI({ apiKey }); }

  async chat(options: LLMRequestOptions) {
    const res = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
    });
    return {
      content: res.choices[0].message.content ?? "",
      usage: {
        promptTokens: res.usage?.prompt_tokens,
        completionTokens: res.usage?.completion_tokens,
        totalTokens: res.usage?.total_tokens,
      },
    };
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

// packages/sdk/src/adapters/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";
export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  constructor(apiKey: string) { this.client = new Anthropic({ apiKey }); }

  async chat(options: LLMRequestOptions) {
    const res = await this.client.messages.create({
      model: options.model,
      max_tokens: 4096,
      messages: options.messages.filter(m => m.role !== "system"),
      system: options.messages.find(m => m.role === "system")?.content,
    });
    return {
      content: res.content[0].type === "text" ? res.content[0].text : "",
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
        totalTokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<string> {
    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: 4096,
      messages: options.messages.filter(m => m.role !== "system"),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}

// Gemini adapter follows same pattern using @google/generative-ai
```

---

## 6. NestJS API (`apps/api`)

### Module structure

```
apps/api/src/
├── main.ts                        # Fastify bootstrap
├── app.module.ts
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts         # POST /chat, GET /chat/stream (SSE)
│   └── chat.service.ts            # uses LLMClient from packages/sdk
├── conversations/
│   ├── conversations.module.ts
│   ├── conversations.controller.ts  # CRUD: list, get, cancel, resume
│   └── conversations.service.ts
├── ingest/
│   ├── ingest.module.ts
│   ├── ingest.controller.ts       # POST /ingest
│   └── ingest.service.ts          # validates → enqueues to BullMQ
├── analytics/
│   ├── analytics.module.ts
│   ├── analytics.controller.ts    # GET /analytics/latency, /throughput, /errors
│   └── analytics.service.ts       # Prisma aggregation queries
└── events/
    └── events.module.ts           # EventEmitter2 global module
```

### `main.ts`

```typescript
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({ origin: process.env.WEB_URL ?? "*" });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");

  await app.listen(process.env.PORT ?? 3001, "0.0.0.0");
}
bootstrap();
```

### Chat controller (SSE streaming)

```typescript
// apps/api/src/chat/chat.controller.ts
import { Controller, Post, Body, Sse, Query, MessageEvent } from "@nestjs/common";
import { Observable, Subject } from "rxjs";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Non-streaming
  @Post()
  async chat(@Body() dto: ChatDto) {
    return this.chatService.chat(dto);
  }

  // Streaming — SSE endpoint
  @Sse("stream")
  stream(@Query() dto: StreamQueryDto): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.chatService.stream(dto, subject);
    return subject.asObservable();
  }
}
```

```typescript
// apps/api/src/chat/chat.service.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { LLMClient } from "@llm-observe/sdk";
import { Subject } from "rxjs";

@Injectable()
export class ChatService {
  constructor(
    private readonly llm: LLMClient,
    private readonly events: EventEmitter2,
    private readonly conversationsService: ConversationsService,
  ) {}

  async stream(dto: StreamQueryDto, subject: Subject<any>) {
    const { conversationId, sessionId, provider, model, content } = dto;

    // Persist user message
    await this.conversationsService.addMessage(conversationId, "user", content);
    this.events.emit("conversation.message_sent", { conversationId, role: "user" });

    let fullResponse = "";
    try {
      for await (const chunk of this.llm.stream({ provider, model, messages, conversationId, sessionId })) {
        fullResponse += chunk;
        subject.next({ data: JSON.stringify({ chunk }) });
      }
      subject.next({ data: JSON.stringify({ done: true }) });

      // Persist assistant message
      await this.conversationsService.addMessage(conversationId, "assistant", fullResponse);
      this.events.emit("conversation.message_sent", { conversationId, role: "assistant" });
    } catch (err) {
      subject.next({ data: JSON.stringify({ error: true, message: err.message }) });
    } finally {
      subject.complete();
    }
  }
}
```

### Ingestion controller

```typescript
// apps/api/src/ingest/ingest.controller.ts
import { Controller, Post, Body, HttpCode } from "@nestjs/common";
import { IngestService } from "./ingest.service";

@Controller("ingest")
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(202)                   // Accepted — async processing
  async ingest(@Body() payload: unknown) {
    await this.ingestService.enqueue(payload);
    return { accepted: true };
  }
}
```

```typescript
// apps/api/src/ingest/ingest.service.ts
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InferenceLogPayloadSchema } from "@llm-observe/types";

@Injectable()
export class IngestService {
  constructor(@InjectQueue("inference-logs") private readonly queue: Queue) {}

  async enqueue(rawPayload: unknown) {
    // Validate with Zod at the API boundary
    const payload = InferenceLogPayloadSchema.parse(rawPayload);
    await this.queue.add("process-log", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
```

### Conversations controller

```typescript
// apps/api/src/conversations/conversations.controller.ts
@Controller("conversations")
export class ConversationsController {
  @Get()
  list(@Query() query: ListConversationsDto) {
    // Returns paginated list — supports status filter
    return this.conversationsService.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.conversationsService.getWithMessages(id);
  }

  @Patch(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.conversationsService.updateStatus(id, "cancelled");
  }

  @Post(":id/resume")
  resume(@Param("id") id: string) {
    // Sets status back to "active", returns conversation with full history
    return this.conversationsService.resume(id);
  }

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }
}
```

### Analytics controller

```typescript
// apps/api/src/analytics/analytics.controller.ts
@Controller("analytics")
export class AnalyticsController {
  @Get("latency")
  latency(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    // Returns p50, p95, p99 latency + avg TTFT bucketed by hour/day
    return this.analyticsService.latency(window);
  }

  @Get("throughput")
  throughput(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    // Returns requests per minute/hour, token counts over time
    return this.analyticsService.throughput(window);
  }

  @Get("errors")
  errors(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    // Returns error rate, error breakdown by code, by provider
    return this.analyticsService.errors(window);
  }

  @Get("summary")
  summary() {
    // Single card stats: total requests, avg latency, success rate, total tokens
    return this.analyticsService.summary();
  }
}
```

Example analytics query (latency):
```typescript
async latency(window: string) {
  const since = windowToDate(window);                // e.g. new Date(Date.now() - 86400000)
  const rows = await this.prisma.inferenceLog.groupBy({
    by: ["provider"],
    where: { createdAt: { gte: since }, status: "success" },
    _avg: { latencyMs: true, ttftMs: true },
    _count: true,
  });
  return rows;
}
```

---

## 7. Worker (`apps/worker`)

The worker is a standalone NestJS application (no HTTP server, just a BullMQ consumer).

```typescript
// apps/worker/src/main.ts
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  await app.init();
  // process stays alive — BullMQ worker handles shutdown gracefully
}
bootstrap();
```

```typescript
// apps/worker/src/log.processor.ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "@llm-observe/db";
import { redactPII } from "@llm-observe/pii";
import type { InferenceLogPayload } from "@llm-observe/types";

@Processor("inference-logs")
export class LogProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) { super(); }

  async process(job: Job<InferenceLogPayload>) {
    const payload = job.data;

    // Step 1: PII redaction on previews
    let inputPreview = payload.inputPreview;
    let outputPreview = payload.outputPreview;
    let piiRedacted = false;

    if (inputPreview) {
      const r = redactPII(inputPreview);
      inputPreview = r.redacted;
      piiRedacted = piiRedacted || r.didRedact;
    }
    if (outputPreview) {
      const r = redactPII(outputPreview);
      outputPreview = r.redacted;
      piiRedacted = piiRedacted || r.didRedact;
    }

    // Step 2: Write to DB
    await this.prisma.inferenceLog.create({
      data: {
        id: payload.logId,
        conversationId: payload.conversationId,
        sessionId: payload.sessionId,
        provider: payload.provider,
        model: payload.model,
        status: payload.status,
        requestStartedAt: new Date(payload.requestStartedAt),
        firstTokenAt: payload.firstTokenAt ? new Date(payload.firstTokenAt) : null,
        requestEndedAt: payload.requestEndedAt ? new Date(payload.requestEndedAt) : null,
        latencyMs: payload.latencyMs,
        ttftMs: payload.ttftMs,
        promptTokens: payload.promptTokens,
        completionTokens: payload.completionTokens,
        totalTokens: payload.totalTokens,
        inputPreview,
        outputPreview,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        metadata: payload.metadata,
        piiRedacted,
      },
    });
  }
}
```

BullMQ retry config (in `ingest.service.ts`): 3 attempts, exponential backoff starting at 1s. Failed jobs after 3 attempts go to the dead-letter queue (BullMQ's failed set) — visible in Bull Board.

**Bull Board** (admin UI for queue monitoring): mount at `GET /admin/queues` in the API using `@bull-board/nestjs`.

---

## 8. Frontend (`apps/web`)

### Stack
- React 18 + Vite
- React Router v6 (`createBrowserRouter`)
- TanStack Query v5 (React Query)
- shadcn/ui + Tailwind CSS v4
- Recharts (dashboard charts)
- Zustand (lightweight client state for active chat)

### Routes

```typescript
// apps/web/src/router.tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/conversations" /> },
      { path: "conversations", element: <ConversationList /> },
      { path: "conversations/:id", element: <ChatView /> },
      { path: "conversations/new", element: <NewConversation /> },
      { path: "dashboard", element: <Dashboard /> },
    ],
  },
]);
```

### Key components

**`ConversationList`** — sidebar + main panel listing all conversations with status badges. Supports filtering by provider and status. Each row shows: title, provider badge, model, last activity, status chip (active / cancelled / completed). Actions: Resume, Cancel, Open.

**`ChatView`** — multi-turn chat UI.
- Message thread with user/assistant bubbles
- Provider + model selector in the header (persisted per conversation)
- Streaming response renders chunk-by-chunk via `EventSource`
- Cancel button aborts the `EventSource` and calls `PATCH /conversations/:id/cancel`
- Input is disabled while streaming

**Streaming on the frontend:**
```typescript
function useStreamingChat() {
  const streamMessage = (conversationId: string, content: string) => {
    const params = new URLSearchParams({ conversationId, content, ... });
    const es = new EventSource(`/api/chat/stream?${params}`);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.chunk) appendChunk(data.chunk);
      if (data.done || data.error) es.close();
    };

    // Store es reference so Cancel button can call es.close()
    setActiveStream(es);
  };
  return { streamMessage };
}
```

**`Dashboard`** — three panels using Recharts:
- **Latency panel**: Line chart of p50/p95 latency over time. Time window toggle (1h / 24h / 7d).
- **Throughput panel**: Bar chart of requests per hour + total tokens. Stacked by provider.
- **Errors panel**: Area chart of error rate. Table of top error codes.
- Summary cards at top: Total Requests, Avg Latency, Success Rate, Total Tokens.

Data fetched with React Query, polling every 30s (`refetchInterval: 30_000`).

### React Query setup

```typescript
// All queries co-located with their feature
export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ["conversations", filters],
    queryFn: () => api.conversations.list(filters),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => api.conversations.get(id),
    enabled: !!id,
  });
}

export function useCancelConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.conversations.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.analytics.summary(),
    refetchInterval: 30_000,
  });
}
```

---

## 9. Event-Based Architecture (internal)

NestJS `EventEmitter2` (global module) is used for internal event decoupling. The chat flow emits events; other modules react without tight coupling.

```typescript
// Events emitted
"conversation.created"       // { conversationId, provider, model }
"conversation.message_sent"  // { conversationId, role }
"conversation.cancelled"     // { conversationId }
"conversation.resumed"       // { conversationId }
"inference.log_received"     // { logId } — emitted after enqueue
"inference.log_processed"    // { logId } — emitted by worker after DB write
```

Listeners can live in any module — analytics cache invalidation, future webhook notifications, etc. — without touching the chat service.

---

## 10. Kubernetes Manifests (`k8s/`)

```
k8s/
├── namespace.yaml
├── configmap.yaml              # non-secret env vars
├── secret.yaml                 # API keys (base64 encoded, or use external-secrets)
├── deployments/
│   ├── api.yaml
│   ├── worker.yaml
│   └── web.yaml
├── services/
│   ├── api-service.yaml
│   ├── worker-service.yaml     # ClusterIP (no external access needed)
│   └── web-service.yaml
├── ingress.yaml                # nginx ingress: / → web, /api → api
├── statefulsets/
│   ├── postgres.yaml           # or point to managed DB
│   └── redis.yaml
└── hpa/
    ├── api-hpa.yaml            # scale on CPU
    └── worker-hpa.yaml         # scale on queue depth (KEDA optional)
```

Key k8s design decisions:
- `api` and `worker` are separate Deployments — worker can scale independently based on queue depth
- `api` gets a `readinessProbe` on `GET /api/health`
- Secrets managed via k8s Secrets (production: use Vault or AWS Secrets Manager)
- HPA for worker: if using KEDA, scale on BullMQ queue length metric via Redis adapter
- Persistent volume for Postgres (or use RDS/Cloud SQL in real deployment)

---

## 11. Environment Variables

```bash
# .env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/llmobserve
REDIS_URL=redis://localhost:6379

# LLM Provider Keys
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# API
PORT=3001
WEB_URL=http://localhost:5173

# Worker (no extra vars needed beyond DB + Redis)

# Web (Vite prefix)
VITE_API_URL=http://localhost:3001
```

---

## 12. README Checklist

Your README should cover:

- [ ] Prerequisites: Docker + Docker Compose, Node 20, pnpm
- [ ] `cp .env.example .env` + fill in API keys
- [ ] `docker compose up --build` — one command to run everything
- [ ] Local dev: `pnpm install && pnpm run dev` (Turborepo runs all apps in parallel)
- [ ] Architecture overview diagram
- [ ] Schema design decisions (see section 2 above)
- [ ] Tradeoffs: Postgres over ClickHouse for simplicity; EventEmitter2 over Kafka for scale; SSE over WebSockets for unidirectional streaming
- [ ] What you'd improve: KEDA for queue-based autoscaling, ClickHouse for long-retention metrics, end-to-end tracing with OpenTelemetry, proper Vault integration for secrets

---

## 13. Build Order for Cursor

Use this order to avoid blocked dependencies:

1. `packages/types` — Zod schemas + shared interfaces
2. `packages/db` — Prisma schema + PrismaService
3. `packages/pii` — redaction utilities
4. `packages/sdk` — LLMClient + provider adapters
5. `apps/api` — NestJS modules (ingest → conversations → chat → analytics)
6. `apps/worker` — BullMQ processor using packages/db + packages/pii
7. `apps/web` — React app (router → queries → components → dashboard)
8. `docker-compose.yml` + Dockerfiles
9. `k8s/` manifests
10. `turbo.json` + root `package.json` scripts