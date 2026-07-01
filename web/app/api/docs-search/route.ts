// 문서 폴더(docs/) 검색 — 챗봇 RAG 근거 조회.
import { NextRequest, NextResponse } from "next/server";
import { searchDocs, listDocFiles } from "@/lib/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const files = listDocFiles();
  const chunks = q.trim() ? searchDocs(q, 6) : [];
  return NextResponse.json({ files, chunks });
}
