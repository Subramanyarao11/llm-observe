import type { LLMRequestOptions } from "@llm-observe/types";

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMAdapter {
  chat(options: LLMRequestOptions): Promise<{ content: string; usage?: TokenUsage }>;
  stream(options: LLMRequestOptions): AsyncGenerator<string, TokenUsage | undefined>;
}

export interface SDKConfig {
  ingestUrl: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
}
