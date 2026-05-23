import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMRequestOptions } from "@llm-observe/types";
import type { LLMAdapter } from "../types.js";

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(options: LLMRequestOptions) {
    const model = this.client.getGenerativeModel({ model: options.model });
    const history = options.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = options.messages.at(-1);
    const chat = model.startChat({ history });
    const res = await chat.sendMessage(lastMessage?.content ?? "");
    const text = res.response.text();
    const usage = res.response.usageMetadata;
    return {
      content: text,
      usage: {
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
    };
  }

  async *stream(options: LLMRequestOptions): AsyncGenerator<string> {
    const model = this.client.getGenerativeModel({ model: options.model });
    const lastMessage = options.messages.at(-1);
    const result = await model.generateContentStream(lastMessage?.content ?? "");
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}
