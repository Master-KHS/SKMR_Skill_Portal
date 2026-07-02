import { NextRequest, NextResponse } from "next/server";
import { runAssistant } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
