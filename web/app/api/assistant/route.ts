import { NextRequest, NextResponse } from "next/server";
import { runAssistant } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY 미설정: web/.env.local 에 키를 추가하세요." },
      { status: 503 }
    );
  }
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "질문이 비어 있습니다." }, { status: 400 });
  }
  try {
    const data = await runAssistant(question, {
      apiKey,
      model: process.env.GEMINI_MODEL,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
