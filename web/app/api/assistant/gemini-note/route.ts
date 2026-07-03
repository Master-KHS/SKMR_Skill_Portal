import { NextRequest, NextResponse } from "next/server";
import { runAssistantGeminiSupplement } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { question, candidateIds } = (await req.json()) as {
    question?: string;
    candidateIds?: string[];
  };

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question is required." }, { status: 400 });
  }

  if (!candidateIds || candidateIds.length === 0) {
    return NextResponse.json({ error: "candidateIds is required." }, { status: 400 });
  }

  try {
    const note = await runAssistantGeminiSupplement(question, candidateIds);
    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
