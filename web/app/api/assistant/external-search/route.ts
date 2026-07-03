import { NextRequest, NextResponse } from "next/server";
import { runAssistantExternalSearch } from "@/lib/assistant-external";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { candidateIds, approved } = (await req.json()) as {
    candidateIds?: string[];
    approved?: boolean;
  };

  if (!approved) {
    return NextResponse.json({ error: "External search approval is required." }, { status: 400 });
  }

  if (!candidateIds || candidateIds.length === 0) {
    return NextResponse.json({ error: "candidateIds is required." }, { status: 400 });
  }

  try {
    const data = await runAssistantExternalSearch(candidateIds);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
