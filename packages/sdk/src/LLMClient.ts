import { v4 as uuid } from "uuid";
import type {
  InferenceMetadata,
  LLMRequestOptions,
  Provider,
} from "@llm-observe/types";
import { AnthropicAdapter } from "./adapters/anthropic.js";
import { GeminiAdapter } from "./adapters/gemini.js";
import { OpenAIAdapter } from "./adapters/openai.js";
import type { LLMAdapter, SDKConfig, TokenUsage } from "./types.js";

export class LLMClient {
  private adapters: Record<Provider, LLMAdapter>;
  private ingestUrl: string;

  constructor(config: SDKConfig) {
    this.ingestUrl = config.ingestUrl.replace(/\/$/, "");
    this.adapters = {
      openai: new OpenAIAdapter(config.openaiApiKey ?? ""),
      anthropic: new AnthropicAdapter(config.anthropicApiKey ?? ""),
      gemini: new GeminiAdapter(config.geminiApiKey ?? ""),
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
    } catch (err: unknown) {
      status = "error";
      const e = err as { code?: string; message?: string };
      errorCode = e.code ?? "UNKNOWN";
      errorMessage = e.message?.slice(0, 500);
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
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
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
    let usage: TokenUsage | undefined;

    try {
      const stream = this.adapters[options.provider].stream(options);
      while (true) {
        const { done, value } = await stream.next();
        if (done) {
          usage = value;
          break;
        }
        if (!firstTokenAt) firstTokenAt = new Date().toISOString();
        fullOutput += value;
        yield value;
      }
    } catch (err: unknown) {
      status = "error";
      const e = err as { code?: string; message?: string };
      errorCode = e.code ?? "UNKNOWN";
      errorMessage = e.message?.slice(0, 500);
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
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
      });
    }
  }

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

export type { LLMAdapter, SDKConfig } from "./types.js";
