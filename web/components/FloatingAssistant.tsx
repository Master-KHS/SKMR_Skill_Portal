"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import type { AssistantResponse, SearchFilters } from "@/lib/assistant-types";

const EXAMPLES = [
  "GC 분석 경험이 있는 후보를 찾아줘",
  "OLED 소재 설계가 가능한 인재를 추천해줘",
  "Photo Resist 평가 경험자를 보여줘",
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
      if (!res.ok) throw new Error(data.error ?? "AI 인재검색에 실패했습니다.");
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
      className={`fixed bottom-6 right-6 z-50 flex max-h-[calc(100vh-4rem)] flex-col border border-[#F4D7B8] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.22)] ${
        expanded ? "h-[78vh] w-[880px]" : "h-[620px] w-[520px]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#F4D7B8] bg-[#FFF8F1] px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/assets/chatbot-robot.png" alt="AI 인재검색 챗봇" className="h-12 w-12 object-contain mix-blend-multiply" />
          <div>
            <div className="text-sm font-extrabold text-text-main">AI 인재검색 챗봇</div>
            <div className="text-xs text-text-muted">Skill Profile 기반 후보 추천</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="border border-[#F4D7B8] bg-white px-2 py-1 text-xs font-semibold text-[#C45E00]"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "축소" : "확대"}
          </button>
          <button
            className="border border-[#F4D7B8] bg-white px-2 py-1 text-xs text-text-muted"
            onClick={() => setOpen(false)}
          >
            닫기
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-4">
        <div className="space-y-4">
          <BotBubble>
            Skill 기반으로 인재를 추천해드립니다. 스킬, 팀, R/L, 직책, 경험 키워드를 자연어로 입력하세요.
          </BotBubble>

          {lastQuestion && <UserBubble>{lastQuestion}</UserBubble>}
          {loading && <BotBubble>내부 Skill Profile과 Raw Data를 확인하는 중입니다...</BotBubble>}
          {error && <div className="border border-sk-red bg-sk-red/[0.06] p-3 text-sm text-sk-red">{error}</div>}

          {response && (
            <>
              <BotBubble>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        response.verification === "pass"
                          ? "success"
                          : response.verification === "fail"
                            ? "danger"
                            : "warning"
                      }
                      label={
                        response.verification === "pass"
                          ? "근거 확인"
                          : response.verification === "fail"
                            ? "후보 없음"
                            : "검토 필요"
                      }
                    />
                    <Badge tone="info" label={`추천 후보 ${response.totalCount}명`} />
                    {!response.grounded && <Badge tone="warning" label="조건 해석 약함" />}
                  </div>
                  {response.interpretedIntent && (
                    <div className="text-xs text-text-muted">해석: {response.interpretedIntent}</div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{response.answer}</div>
                </div>
              </BotBubble>

              <Panel title="해석된 조건">
                {summary.length === 0 ? (
                  <div className="text-sm text-text-muted">구조화된 조건을 충분히 추출하지 못했습니다.</div>
                ) : (
                  <div className="grid gap-2 text-sm">
                    {summary.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 border-b border-border-soft pb-2 last:border-0">
                        <span className="text-text-muted">{label}</span>
                        <span className="text-right font-semibold text-text-main">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title={`추천 인재 ${response.results.length}명`}>
                {response.results.length === 0 ? (
                  <div className="text-sm text-text-muted">현재 조건에 맞는 후보가 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    {response.results.slice(0, expanded ? 12 : 6).map((row) => (
                      <div key={row.employee_id} className="border border-border-soft bg-white p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-extrabold text-text-main">{row.name}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                              {row.division ?? "-"} / {row.team ?? "-"} · {row.role_level ?? "-"} / {row.position ?? "-"}
                            </div>
                          </div>
                          <div className="text-right text-xs text-text-muted">
                            Skill {row.n_skills}
                            <br />
                            Avg L{row.avg_level}
                          </div>
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-text-muted">
                          {row.matched.length > 0
                            ? row.matched.map((matched) => `${matched.skill_name} L${matched.level}`).join(", ")
                            : "직접 매칭 Skill 없음"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-[#F4D7B8] bg-[#FFF8F1] p-3">
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 border border-[#F4D7B8] bg-white px-3 py-2 text-sm outline-none focus:border-sk-orange"
            placeholder="예: OLED 소재 설계 후보 추천"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") ask(question);
            }}
          />
          <button
            className="bg-sk-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => ask(question)}
            disabled={loading}
          >
            질문
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              className="border border-[#F4D7B8] bg-white px-2 py-1 text-[11px] text-text-muted hover:border-sk-orange"
              onClick={() => {
                setQuestion(example);
                ask(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] border border-[#F4D7B8] bg-[#FFF8F1] px-4 py-3 text-sm leading-relaxed text-text-main">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] border border-sk-orange bg-sk-orange px-4 py-3 text-sm leading-relaxed text-white">
        {children}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#F4D7B8] bg-white">
      <div className="border-b border-[#F4D7B8] bg-[#FFF8F1] px-3 py-2 text-xs font-extrabold text-text-main">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
