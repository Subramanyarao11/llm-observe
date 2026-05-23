import OpenAI from "openai";
import type { LLMRequestOptions } from "@llm-observe/types";
import type { LLMAdapter, TokenUsage } from "../types.js";

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(options: LLMRequestOptions) {
    const res = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
    });
    return {
      content: res.choices[0]?.message?.content ?? "",
      usage: {
        promptTokens: res.usage?.prompt_tokens,
        completionTokens: res.usage?.completion_tokens,
        totalTokens: res.usage?.total_tokens,
      },
    };
  }

  async *stream(
    options: LLMRequestOptions,
  ): AsyncGenerator<string, TokenUsage | undefined> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      stream: true,
      stream_options: { include_usage: true },
    });
    let usage: TokenUsage | undefined;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }
    }
    return usage;
  }
}
