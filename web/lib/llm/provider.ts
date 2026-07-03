export interface LlmMessage {
  role: "user" | "model";
  text: string;
}

export interface LlmProvider {
  name: string;
  complete(system: string, messages: LlmMessage[]): Promise<string>;
  completeJson(system: string, messages: LlmMessage[]): Promise<string>;
  completeGrounded?(system: string, messages: LlmMessage[]): Promise<string>;
}

import { GeminiProvider } from "./gemini";

let cached: LlmProvider | null = null;

export function getProvider(): LlmProvider {
  if (cached) return cached;
  const which = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  switch (which) {
    case "gemini":
    default:
      cached = new GeminiProvider();
      return cached;
  }
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
