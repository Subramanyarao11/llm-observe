import { z } from "zod";

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
  requestStartedAt: string;
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

export const InferenceLogPayloadSchema = z.object({
  logId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string().min(1),
  requestStartedAt: z.string().datetime(),
  firstTokenAt: z.string().datetime().optional(),
  requestEndedAt: z.string().datetime().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  ttftMs: z.number().int().nonnegative().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  status: z.enum(["success", "error", "streaming"]),
  inputPreview: z.string().max(500).optional(),
  outputPreview: z.string().max(500).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type InferenceLogPayload = z.infer<typeof InferenceLogPayloadSchema>;
