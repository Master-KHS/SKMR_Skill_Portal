"use client";

import { useMemo, useState } from "react";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { AssistantResponse, SearchFilters } from "@/lib/assistant-types";

const EXAMPLES = [
  "GC 분석 스킬 L3 이상 보유한 연구직 찾아줘",
  "공정 개선 경험이 있을 만한 인재를 추천해줘",
  "소재개발팀에서 OLED 소재 설계 가능한 후보를 보여줘",
];

interface AssistantMeta {
  skills: { skill_id: number; skill_name: string }[];
  divisions: string[];
  teams: string[];
}

function filterEntries(filters: SearchFilters) {
  return [
    filters.division ? ["담당", filters.division] : null,
    filters.team ? ["팀", filters.team] : null,
    filters.job_type ? ["직종", filters.job_type] : null,
    filters.role_level ? ["R/L", filters.role_level] : null,
    filters.position ? ["직책", filters.position] : null,
    (filters.skills?.length ?? 0) > 0
      ? ["스킬", filters.skills!.map((skill) => `#${skill.skill_id} L${skill.min_level}+`).join(", ")]
      : null,
  ].filter(Boolean) as [string, string][];
}

export function AssistantClient({ meta }: { meta: AssistantMeta }) {
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    if (!response) return [];
    return filterEntries(response.filters);
  }, [response]);

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setLastQuestion(trimmed);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI talent search failed.");
      setResponse(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAnswer() {
    if (!response) return;
    await navigator.clipboard.writeText(response.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const verificationBadge = response
    ? response.verification === "pass"
      ? <Badge tone="success" label="검증 Pass" />
      : response.verification === "fail"
        ? <Badge tone="danger" label="검증 Fail" />
        : <Badge tone="warning" label="검증 Review" />
    : null;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="AI 인재 검색"
        desc="자연어 질의를 구조화 조건으로 바꾸고, 현재 보유 스킬/조직 정보와 문서 근거를 함께 묶어 추천합니다."
      />

      <Card className="mb-4">
        <div className="flex gap-2">
          <input
            className="flex-1 border border-border-soft bg-white px-3 py-2 text-sm"
            placeholder="예: GC 분석 스킬 L3 이상 보유한 연구직을 소재개발팀에서 찾아줘"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") ask(question);
            }}
          />
          <button
            className="bg-sk-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => ask(question)}
            disabled={loading}
          >
            {loading ? "검색 중..." : "질의"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              className="border border-border-soft px-2 py-1 text-xs text-text-muted hover:border-sk-orange"
              onClick={() => {
                setQuestion(example);
                ask(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-text-muted">
          <div>등록 Skill {meta.skills.length}개</div>
          <div>담당 {meta.divisions.length}개</div>
          <div>팀 {meta.teams.length}개</div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 border border-sk-red bg-sk-red/[0.06] p-3 text-sm text-sk-red">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {verificationBadge}
            <Badge tone="info" label={`추천 후보 ${response.totalCount}명`} />
            {!response.grounded && <Badge tone="warning" label="조건 해석 약함" />}
            {response.interpretedIntent && (
              <span className="text-xs text-text-muted">의도: {response.interpretedIntent}</span>
            )}
          </div>

          {response.unresolvedSkills.length > 0 && (
            <div className="border border-warning bg-warning/[0.08] p-3 text-sm text-[#9A6500]">
              매칭되지 않은 스킬명: {response.unresolvedSkills.join(", ")}
            </div>
          )}

          <div className="grid grid-cols-[1.4fr,1fr] gap-4">
            <Card title="AI 요약">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{response.answer}</div>
              <div className="mt-4 flex gap-2 border-t border-border-soft pt-3">
                <button
                  className="border border-sk-orange px-3 py-1.5 text-xs font-medium text-[#C45E00]"
                  onClick={copyAnswer}
                >
                  {copied ? "복사됨" : "요약 복사"}
                </button>
                <button
                  className="border border-border-soft px-3 py-1.5 text-xs text-text-muted"
                  onClick={() => ask(lastQuestion)}
                >
                  다시 실행
                </button>
              </div>
            </Card>

            <Card title="해석된 검색 조건">
              {summary.length === 0 ? (
                <div className="text-sm text-text-muted">구조화된 조건이 충분히 추출되지 않았습니다.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {summary.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-border-soft pb-2 last:border-0">
                      <span className="text-text-muted">{label}</span>
                      <span className="text-right font-medium text-text-main">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-[1.4fr,1fr] gap-4">
            <Card title={`추천 인재 ${response.results.length}명`}>
              {response.results.length === 0 ? (
                <div className="text-sm text-text-muted">현재 조건에 맞는 후보가 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-border-soft text-left text-text-muted">
                        <th className="py-2 pr-3">이름</th>
                        <th className="py-2 pr-3">조직</th>
                        <th className="py-2 pr-3">직무</th>
                        <th className="py-2 pr-3 text-right">보유 Skill</th>
                        <th className="py-2 pr-3 text-right">평균 Level</th>
                        <th className="py-2">매칭 스킬</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.results.map((row) => (
                        <tr key={row.employee_id} className="border-b border-border-soft align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{row.name}</div>
                            <div className="font-mono text-xs text-text-muted">{row.employee_id}</div>
                          </td>
                          <td className="py-2 pr-3 text-text-muted">
                            {row.division ?? "-"} / {row.team ?? "-"}
                          </td>
                          <td className="py-2 pr-3 text-text-muted">
                            {row.role_level ?? "-"} / {row.position ?? "-"}
                          </td>
                          <td className="py-2 pr-3 text-right">{row.n_skills}</td>
                          <td className="py-2 pr-3 text-right">{row.avg_level}</td>
                          <td className="py-2">
                            {row.matched.length > 0 ? row.matched.map((matched) => `${matched.skill_name} L${matched.level}`).join(", ") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="후속 액션">
              <div className="space-y-2 text-sm">
                {response.followUpSuggestions.map((item) => (
                  <div key={item} className="border-b border-border-soft pb-2 last:border-0">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-[1.2fr,1fr] gap-4">
            <Card title={`문서 근거 ${response.docEvidence.length}건`}>
              {response.docEvidence.length === 0 ? (
                <div className="text-sm text-text-muted">
                  아직 연결된 문서 근거가 없습니다. 로데이터 포맷이 정해지면 결과별 문서 근거를 더 강하게 붙일 수 있습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {response.docEvidence.map((chunk) => (
                    <div key={`${chunk.file}-${chunk.loc}`} className="border border-border-soft bg-white p-3">
                      <div className="text-xs text-text-muted">
                        {chunk.file} / {chunk.loc}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed">{chunk.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="로데이터 준비 상태">
              <div className="space-y-3">
                {response.dataSlots.map((slot) => (
                  <div key={slot.key} className="border-b border-border-soft pb-3 last:border-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-text-main">{slot.label}</span>
                      <Badge
                        tone={slot.status === "ready" ? "success" : "warning"}
                        label={slot.status === "ready" ? "Ready" : "정의 필요"}
                      />
                    </div>
                    <div className="text-xs leading-relaxed text-text-muted">{slot.note}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
