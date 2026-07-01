import { NextRequest, NextResponse } from "next/server";
import { runAssistant } from "@/lib/assistant";
import { isLlmConfigured } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured. Add it to web/.env.local to enable AI talent search." },
      { status: 503 }
    );
  }

  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  try {
    const data = await runAssistant(question);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
