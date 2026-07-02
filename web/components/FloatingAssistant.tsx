"use client";

import { useMemo, useState } from "react";
import type { AssistantResponse, SearchFilters } from "@/lib/assistant-types";

const EXAMPLES = [
  "GC 분석 스킬 L3 이상 보유자를 찾아줘",
  "OLED 소재 설계가 가능한 후보를 보여줘",
  "Photo Resist 평가 경험자를 추천해줘",
];

function filterEntries(filters: SearchFilters) {
  return [
    filters.division ? ["담당", filters.division] : null,
    filters.team ? ["팀", filters.team] : null,
    filters.job_type ? ["직종", filters.job_type] : null,
    filters.role_level ? ["R/L", filters.role_level] : null,
    filters.position ? ["직책", filters.position] : null,
    (filters.skills?.length ?? 0) > 0
      ? ["Skill", filters.skills!.map((skill) => `#${skill.skill_id} L${skill.min_level}+`).join(", ")]
      : null,
  ].filter(Boolean) as [string, string][];
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);

  const summary = useMemo(() => (response ? filterEntries(response.filters) : []), [response]);

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    setOpen(true);
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
      if (!res.ok) throw new Error(data.error ?? "AI 인재검색 호출에 실패했습니다.");
      setResponse(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        className="fixed bottom-4 right-4 z-50 block h-36 w-36 border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition hover:scale-105 focus:outline-none"
        onClick={() => setOpen(true)}
        title="AI 인재검색 챗봇 열기"
      >
        <img
          src="/assets/chatbot-robot.png"
          alt="AI 인재검색 챗봇"
          className="h-full w-full object-contain mix-blend-multiply drop-shadow-[0_14px_24px_rgba(0,0,0,0.28)]"
        />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 border border-sk-orange/30 bg-[#FFF8F1] shadow-2xl ${
        expanded ? "h-[82vh] w-[760px]" : "h-[620px] w-[500px]"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-sk-orange/25 bg-[#FFF3E5] px-4 py-3">
        <img src="/assets/chatbot-robot.png" alt="" className="h-11 w-11 object-contain mix-blend-multiply" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-text-main">AI 인재검색 챗봇</div>
          <div className="text-xs text-text-muted">Skill Profile 기반 후보 추천</div>
        </div>
        <button
          className="border border-sk-orange/40 bg-white px-3 py-1.5 text-xs font-bold text-[#C45E00]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "축소" : "확대"}
        </button>
        <button
          className="border border-sk-orange/40 bg-white px-3 py-1.5 text-xs font-bold text-[#C45E00]"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>

      <div className="flex h-[calc(100%-64px)] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="border border-sk-orange/25 bg-white px-4 py-3 text-sm leading-relaxed text-text-main">
            <div className="font-bold">Skill 기반으로 인재를 추천해드립니다.</div>
            <div className="mt-1 text-text-muted">
              스킬, 팀, R/L, 직책, 경험 키워드를 자연어로 입력하세요.
            </div>
          </div>

          {lastQuestion && (
            <div className="ml-auto max-w-[86%] bg-sk-orange px-4 py-3 text-sm font-semibold text-white">
              {lastQuestion}
            </div>
          )}

          {loading && (
            <div className="border border-border-soft bg-white px-4 py-3 text-sm text-text-muted">
              후보 데이터와 Skill Profile을 확인하는 중입니다...
            </div>
          )}

          {error && (
            <div className="border border-sk-red bg-white px-4 py-3 text-sm leading-relaxed text-sk-red">
              {error}
            </div>
          )}

          {response && (
            <div className="space-y-3">
              <div className="border border-border-soft bg-white px-4 py-3">
                <div className="text-sm font-extrabold text-text-main">분석 요약</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-main">{response.answer}</p>
              </div>

              {summary.length > 0 && (
                <div className="border border-border-soft bg-white px-4 py-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-text-muted">적용 조건</div>
                  <div className="flex flex-wrap gap-2">
                    {summary.map(([label, value]) => (
                      <span key={`${label}-${value}`} className="border border-sk-orange/30 bg-[#FFF8F1] px-2 py-1 text-xs">
                        <b>{label}</b> {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {response.results.length > 0 && (
                <div className="border border-border-soft bg-white">
                  <div className="border-b border-border-soft px-4 py-2 text-sm font-extrabold text-text-main">
                    추천 후보 {response.totalCount}명
                  </div>
                  <div className="divide-y divide-border-soft">
                    {response.results.slice(0, 5).map((row) => (
                      <div key={row.employee_id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-bold text-text-main">{row.name}</div>
                          <div className="text-xs text-text-muted">
                            {row.team ?? "-"} · {row.role_level ?? "-"} · 평균 L{row.avg_level.toFixed(1)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          {row.matched.map((skill) => `${skill.skill_name} L${skill.level.toFixed(1)}`).join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-sk-orange/25 bg-[#FFF8F1] p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                className="border border-sk-orange/30 bg-white px-2 py-1 text-[11px] text-text-muted hover:text-text-main"
                onClick={() => {
                  setQuestion(example);
                  void ask(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
          >
            <input
              className="min-w-0 flex-1 border border-sk-orange/30 bg-white px-3 py-2 text-sm outline-none focus:border-sk-orange"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="찾고 싶은 인재 조건을 입력하세요"
            />
            <button className="bg-sk-orange px-4 py-2 text-sm font-extrabold text-white" disabled={loading}>
              질문
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
