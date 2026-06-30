import { NextRequest, NextResponse } from "next/server";
import { searchTalent, type SearchFilters } from "@/lib/search";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const filters = (await req.json()) as SearchFilters;
  const results = searchTalent(filters).sort((a, b) => b.avg_level - a.avg_level);
  return NextResponse.json({ results, count: results.length });
}
