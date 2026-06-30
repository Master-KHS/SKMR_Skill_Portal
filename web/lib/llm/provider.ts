// LLM 추상화 레이어.
// 현재는 Gemini. 회사 Bedrock 계약 완료 시 BedrockProvider만 추가하고
// getProvider()의 분기 한 줄만 바꾸면 전환됨. 호출부(API 라우트)는 수정 불필요.

export interface LlmMessage {
  role: "user" | "model";
  text: string;
}

export interface LlmProvider {
  name: string;
  // 자유 텍스트 응답
  complete(system: string, messages: LlmMessage[]): Promise<string>;
  // JSON만 반환하도록 강제 (검색 조건 추출 등)
  completeJson(system: string, messages: LlmMessage[]): Promise<string>;
}

import { GeminiProvider } from "./gemini";

let cached: LlmProvider | null = null;

export function getProvider(): LlmProvider {
  if (cached) return cached;
  const which = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  switch (which) {
    // case "bedrock": cached = new BedrockProvider(); break;  // 추후 추가
    case "gemini":
    default:
      cached = new GeminiProvider();
  }
  return cached;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
