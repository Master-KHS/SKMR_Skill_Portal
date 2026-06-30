// AI 인재 검색 — 하이브리드 RAG.
// 1) Gemini가 자연어 질문 → 검색 조건(JSON)으로 해석 (보유 스킬명은 카탈로그로 그라운딩)
// 2) 서버가 로컬 데이터에서 실제 검색 수행 (개인 데이터는 LLM으로 안 넘기고 코드로 처리)
// 3) Gemini가 검색 결과를 근거로 자연어 요약 (출처 = 사번/이름)
import { NextRequest, NextResponse } from "next/server";
import { getProvider, isLlmConfigured } from "@/lib/llm/provider";
import { getSkills, getMembers } from "@/lib/data";
import { searchTalent, type SearchFilters, type SkillCondition } from "@/lib/search";

export const runtime = "nodejs";

interface InterpretResult {
  skill_queries?: { name: string; min_level?: number }[];
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  position?: string;
  intent?: string;
}

export async function POST(req: NextRequest) {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      {
        error:
          "LLM 미설정: web/.env.local 에 GEMINI_API_KEY 를 추가하세요. (예: GEMINI_API_KEY=...)",
      },
      { status: 503 }
    );
  }

  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) {
    return NextResponse.json({ error: "질문이 비어 있습니다." }, { status: 400 });
  }

  const provider = getProvider();
  const skills = getSkills();
  const skillCatalog = skills
    .map((s) => `${s.skill_id}|${s.skill_name}`)
    .join("\n");
  const divisions = [...new Set(getMembers().map((m) => m.division).filter(Boolean))];
  const teams = [...new Set(getMembers().map((m) => m.team).filter(Boolean))];

  // 1) 해석
  const interpretSystem = `당신은 SKMR 스킬 포탈의 인재 검색 해석기입니다.
사용자의 자연어 질문을 검색 조건 JSON으로 변환하세요.
보유 스킬은 반드시 아래 스킬 카탈로그의 이름 표현을 사용해 skill_queries.name 에 핵심 키워드로 넣으세요(부분 일치로 매칭됨).
min_level 은 1~4(언급 없으면 생략). 조직 필터는 아래 목록 값과 일치할 때만 채우세요.

[스킬 카탈로그 id|name]
${skillCatalog}

[담당(division) 목록] ${divisions.join(", ")}
[팀(team) 목록] ${teams.join(", ")}

반드시 다음 JSON 스키마로만 답하세요:
{"skill_queries":[{"name":"키워드","min_level":2}],"division":null,"team":null,"job_type":null,"role_level":null,"position":null,"intent":"한줄요약"}`;

  let interp: InterpretResult = {};
  try {
    const raw = await provider.completeJson(interpretSystem, [
      { role: "user", text: question },
    ]);
    interp = JSON.parse(raw);
  } catch (e) {
    return NextResponse.json(
      { error: `질문 해석 실패: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  // 2) 스킬명 → skill_id 해석 + 로컬 검색
  const conds: SkillCondition[] = [];
  const unresolved: string[] = [];
  for (const q of interp.skill_queries ?? []) {
    const ql = q.name.trim().toLowerCase();
    const hit = skills.find((s) => s.skill_name.toLowerCase().includes(ql));
    if (hit) conds.push({ skill_id: hit.skill_id, min_level: q.min_level ?? 1 });
    else unresolved.push(q.name);
  }

  const filters: SearchFilters = {
    division: interp.division || undefined,
    team: interp.team || undefined,
    job_type: interp.job_type || undefined,
    role_level: interp.role_level || undefined,
    position: interp.position || undefined,
    skills: conds,
  };
  const results = searchTalent(filters).sort((a, b) => b.avg_level - a.avg_level);

  // 근거 부족 판단
  const grounded = conds.length > 0 || Boolean(filters.division || filters.team || filters.role_level);
  const verification: "pass" | "fail" | "review" =
    !grounded ? "review" : results.length > 0 ? "pass" : "fail";

  // 3) 요약 (결과를 근거로)
  const top = results.slice(0, 8);
  const resultContext = top
    .map(
      (r) =>
        `${r.name}(${r.employee_id}) ${r.division}/${r.team} ${r.role_level} ${r.position} · 보유스킬 ${r.n_skills}개 평균L${r.avg_level}` +
        (r.matched.length
          ? ` · 매칭: ${r.matched.map((m) => `${m.skill_name} L${m.level}`).join(", ")}`
          : "")
    )
    .join("\n");

  const answerSystem = `당신은 SKMR HR 인재 검색 도우미입니다. 아래 '검색 결과'에 있는 사실만 근거로 한국어로 간결히 답하세요.
결과에 없는 내용을 지어내지 마세요. 결과가 없으면 조건 완화를 제안하세요. 추천 인재는 이름과 사번을 함께 언급하세요.`;
  const answerUser = `질문: ${question}
해석된 조건: ${JSON.stringify(filters)}
${unresolved.length ? `매칭 실패 스킬: ${unresolved.join(", ")}\n` : ""}검색 결과(${results.length}명, 상위 ${top.length}명):
${resultContext || "(없음)"}`;

  let answer = "";
  try {
    answer = await provider.complete(answerSystem, [{ role: "user", text: answerUser }]);
  } catch (e) {
    answer = `요약 생성 실패: ${(e as Error).message}`;
  }

  return NextResponse.json({
    answer,
    filters,
    interpretedIntent: interp.intent ?? null,
    unresolvedSkills: unresolved,
    results: top,
    totalCount: results.length,
    sources: top.map((r) => ({ employee_id: r.employee_id, name: r.name, team: r.team })),
    verification,
    grounded,
  });
}
