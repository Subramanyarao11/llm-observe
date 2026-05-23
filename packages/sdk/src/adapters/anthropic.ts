import Anthropic from "@anthropic-ai/sdk";
import type { LLMRequestOptions } from "@llm-observe/types";
import type { LLMAdapter, TokenUsage } from "../types.js";

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(options: LLMRequestOptions) {
    const messages = options.messages.filter(
      (m): m is Extract<typeof m, { role: "user" | "assistant" }> =>
        m.role !== "system",
    );
    const res = await this.client.messages.create({
      model: options.model,
      max_tokens: 4096,
      messages,
      system: options.messages.find((m) => m.role === "system")?.content,
    });
    const block = res.content[0];
    return {
      content: block?.type === "text" ? block.text : "",
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
        totalTokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }

  async *stream(
    options: LLMRequestOptions,
  ): AsyncGenerator<string, TokenUsage | undefined> {
    const messages = options.messages.filter(
      (m): m is Extract<typeof m, { role: "user" | "assistant" }> =>
        m.role !== "system",
    );
    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: 4096,
      messages,
      system: options.messages.find((m) => m.role === "system")?.content,
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
    const finalMessage = await stream.finalMessage();
    return {
      promptTokens: finalMessage.usage.input_tokens,
      completionTokens: finalMessage.usage.output_tokens,
      totalTokens:
        finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
    };
  }
}
