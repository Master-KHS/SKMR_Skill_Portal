import type { LlmMessage, LlmProvider } from "./provider";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
let quotaBlockedUntil = 0;

export class GeminiProvider implements LlmProvider {
  name = "gemini";

  private model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  private async call(system: string, messages: LlmMessage[], jsonMode: boolean): Promise<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_KEY_MISSING");
    if (Date.now() < quotaBlockedUntil) throw new Error("GEMINI_QUOTA_BLOCKED");

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      })),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${this.model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      if (res.status === 429) {
        quotaBlockedUntil = Date.now() + 10 * 60 * 1000;
        throw new Error("GEMINI_QUOTA_EXCEEDED");
      }
      if (res.status === 400) throw new Error("GEMINI_BAD_REQUEST");
      if (res.status === 401 || res.status === 403) throw new Error("GEMINI_AUTH_FAILED");
      throw new Error(`GEMINI_HTTP_${res.status}`);
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
