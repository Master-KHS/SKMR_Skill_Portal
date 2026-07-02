import type { LlmMessage, LlmProvider } from "./provider";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements LlmProvider {
  name = "gemini";

  private model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  private async call(system: string, messages: LlmMessage[], jsonMode: boolean): Promise<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다.");

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      })),
      generationConfig: {
        temperature: 0.2,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    const res = await fetch(`${API_BASE}/${this.model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini API 오류 ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    return text.trim();
  }

  complete(system: string, messages: LlmMessage[]) {
    return this.call(system, messages, false);
  }

  completeJson(system: string, messages: LlmMessage[]) {
    return this.call(system, messages, true);
  }
}
