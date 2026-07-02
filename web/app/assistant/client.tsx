"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import type { AssistantResponse, SearchFilters } from "@/lib/assistant-types";

const EXAMPLES = [
  "GC 분석 스킬 L3 이상 보유자를 소재개발팀에서 찾아줘",
  "공정 개선 경험이 있을 만한 인재를 추천해줘",
  "OLED 소재 설계가 가능한 후보를 보여줘",
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
      if (!res.ok) throw new Error(data.error ?? "AI 인재검색에 실패했습니다.");
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
        : <Badge tone="warning" label="검토 필요" />
    : null;

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-[#FFF8F1] p-0">
      <div className="grid min-h-[calc(100vh-9rem)] grid-cols-[300px,1fr] overflow-hidden border border-[#F4D7B8] bg-white">
        <aside className="border-r border-[#F4D7B8] bg-[#FFF2E3] p-6">
          <div className="flex h-full flex-col">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#C45E00]">
                AI Talent Search
              </div>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight text-text-main">
                AI 인재검색
                <br />
                챗봇
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                자연어 질문을 조건으로 바꾸고, 현재 Skill Profile과 조직 정보를 기준으로 후보를 추천합니다.
              </p>
            </div>

            <div className="my-7 flex justify-center">
              <img
                src="/assets/chatbot-robot.png"
                alt="AI chatbot"
                className="h-44 w-44 object-contain"
              />
            </div>

            <div className="space-y-2 border-t border-[#F4D7B8] pt-4 text-sm">
              <Metric label="등록 Skill" value={`${meta.skills.length}개`} />
              <Metric label="담당" value={`${meta.divisions.length}개`} />
              <Metric label="팀" value={`${meta.teams.length}개`} />
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col bg-white">
          <div className="border-b border-[#F4D7B8] bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-text-main">인재 추천 대화</div>
                <div className="mt-1 text-xs text-text-muted">
                  raw data 정의 전에는 현재 보유 데이터 기준으로만 근거를 제시합니다.
                </div>
              </div>
              <Badge tone="orange" label="Chat Mode" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              <ChatBubble side="bot">
                찾고 싶은 인재 조건을 자연어로 입력하세요. 예: 특정 스킬, 팀, R/L, 직책, 경험 키워드
              </ChatBubble>

              {lastQuestion && <ChatBubble side="user">{lastQuestion}</ChatBubble>}

              {error && (
                <div className="border border-sk-red bg-sk-red/[0.06] p-3 text-sm text-sk-red">
                  {error}
                </div>
              )}

              {loading && (
                <ChatBubble side="bot">
                  조건을 해석하고 후보를 찾는 중입니다...
                </ChatBubble>
              )}

              {response && (
                <>
                  <ChatBubble side="bot">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {verificationBadge}
                        <Badge tone="info" label={`추천 후보 ${response.totalCount}명`} />
                        {!response.grounded && <Badge tone="warning" label="조건 해석 약함" />}
                      </div>
                      {response.interpretedIntent && (
                        <div className="text-xs text-text-muted">의도: {response.interpretedIntent}</div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{response.answer}</div>
                      <div className="flex gap-2 border-t border-[#F4D7B8] pt-3">
                        <button
                          className="border border-sk-orange px-3 py-1.5 text-xs font-semibold text-[#C45E00]"
                          onClick={copyAnswer}
                        >
                          {copied ? "복사됨" : "답변 복사"}
                        </button>
                        <button
                          className="border border-border-soft px-3 py-1.5 text-xs text-text-muted"
                          onClick={() => ask(lastQuestion)}
                        >
                          다시 실행
                        </button>
                      </div>
                    </div>
                  </ChatBubble>

                  {response.unresolvedSkills.length > 0 && (
                    <Panel title="매칭되지 않은 스킬명">
                      <div className="text-sm text-[#9A6500]">{response.unresolvedSkills.join(", ")}</div>
                    </Panel>
                  )}

                  <div className="grid grid-cols-[1.35fr,0.9fr] gap-4">
                    <Panel title={`추천 인재 ${response.results.length}명`}>
                      {response.results.length === 0 ? (
                        <div className="text-sm text-text-muted">현재 조건에 맞는 후보가 없습니다.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-[#F4D7B8] text-left text-text-muted">
                                <th className="py-2 pr-3">이름</th>
                                <th className="py-2 pr-3">조직</th>
                                <th className="py-2 pr-3">직무</th>
                                <th className="py-2 pr-3 text-right">Skill</th>
                                <th className="py-2 pr-3 text-right">평균</th>
                                <th className="py-2">매칭 스킬</th>
                              </tr>
                            </thead>
                            <tbody>
                              {response.results.map((row) => (
                                <tr key={row.employee_id} className="border-b border-border-soft align-top">
                                  <td className="py-2 pr-3">
                                    <div className="font-semibold text-text-main">{row.name}</div>
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
                                    {row.matched.length > 0
                                      ? row.matched.map((matched) => `${matched.skill_name} L${matched.level}`).join(", ")
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Panel>

                    <div className="space-y-4">
                      <Panel title="해석된 조건">
                        {summary.length === 0 ? (
                          <div className="text-sm text-text-muted">구조화된 조건이 충분히 추출되지 않았습니다.</div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            {summary.map(([label, value]) => (
                              <div key={label} className="flex justify-between gap-4 border-b border-border-soft pb-2 last:border-0">
                                <span className="text-text-muted">{label}</span>
                                <span className="text-right font-semibold text-text-main">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Panel>

                      <Panel title="후속 질문">
                        <div className="space-y-2 text-sm">
                          {response.followUpSuggestions.map((item) => (
                            <button
                              key={item}
                              className="block w-full border border-border-soft bg-white px-3 py-2 text-left hover:border-sk-orange"
                              onClick={() => {
                                setQuestion(item);
                                ask(item);
                              }}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </Panel>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1.2fr,1fr] gap-4">
                    <Panel title={`문서 근거 ${response.docEvidence.length}건`}>
                      {response.docEvidence.length === 0 ? (
                        <div className="text-sm text-text-muted">
                          아직 연결된 문서 근거가 없습니다. raw data 정의가 보강되면 결과별 근거를 더 강하게 붙일 수 있습니다.
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
                    </Panel>

                    <Panel title="raw data 준비 상태">
                      <div className="space-y-3">
                        {response.dataSlots.map((slot) => (
                          <div key={slot.key} className="border-b border-border-soft pb-3 last:border-0">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-semibold text-text-main">{slot.label}</span>
                              <Badge
                                tone={slot.status === "ready" ? "success" : "warning"}
                                label={slot.status === "ready" ? "Ready" : "정의 필요"}
                              />
                            </div>
                            <div className="text-xs leading-relaxed text-text-muted">{slot.note}</div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-[#F4D7B8] bg-[#FFF8F1] p-4">
            <div className="flex gap-2">
              <input
                className="flex-1 border border-[#F4D7B8] bg-white px-4 py-3 text-sm outline-none focus:border-sk-orange"
                placeholder="예: OLED 소재 설계가 가능한 후보를 추천해줘"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") ask(question);
                }}
              />
              <button
                className="bg-sk-orange px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => ask(question)}
                disabled={loading}
              >
                {loading ? "검색 중" : "질문"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  className="border border-[#F4D7B8] bg-white px-3 py-1.5 text-xs text-text-muted hover:border-sk-orange hover:text-[#C45E00]"
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
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-[#F4D7B8] bg-white px-3 py-2">
      <span className="text-text-muted">{label}</span>
      <span className="font-extrabold text-[#C45E00]">{value}</span>
    </div>
  );
}

function ChatBubble({ side, children }: { side: "bot" | "user"; children: React.ReactNode }) {
  const isUser = side === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] border px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "border-sk-orange bg-sk-orange text-white"
            : "border-[#F4D7B8] bg-[#FFF8F1] text-text-main"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#F4D7B8] bg-white">
      <div className="border-b border-[#F4D7B8] bg-[#FFF8F1] px-4 py-2.5 text-[13px] font-extrabold text-text-main">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
