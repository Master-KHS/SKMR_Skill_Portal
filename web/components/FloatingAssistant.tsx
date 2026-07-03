"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AssistantResponse, SearchFilters } from "@/lib/assistant-types";

const EXAMPLES = [
  "GC 분석 Skill L3 이상 보유자를 찾아줘",
  "OLED 소재 설계가 가능한 후보를 보여줘",
  "Photo Resist 평가 경험자를 추천해줘",
  "김선재의 보유 Skill과 강점을 보여줘",
  "유림훈의 보유 Skill과 강점을 보여줘",
  "정현수의 경력과 핵심 Skill을 요약해줘",
];

const STORAGE_KEY = "floating-assistant-position-v1";
const DEFAULT_GAP = 16;
const BAR_COLORS = ["#EA002C", "#FF7A00", "#2563EB", "#00A3A3", "#16A34A"];

function filterEntries(filters: SearchFilters) {
  return [
    filters.member_name ? ["구성원", filters.member_name] : null,
    filters.division ? ["담당", filters.division] : null,
    filters.team ? ["팀", filters.team] : null,
    filters.job_type ? ["직종", filters.job_type] : null,
    filters.role_level ? ["R/L", filters.role_level] : null,
    filters.role_level_max ? ["R/L 최대", filters.role_level_max] : null,
    filters.role_level_min ? ["R/L 최소", filters.role_level_min] : null,
    filters.position ? ["직책", filters.position] : null,
    (filters.skills?.length ?? 0) > 0
      ? ["Skill", filters.skills!.map((skill) => `#${skill.skill_id} L${skill.min_level}+`).join(", ")]
      : null,
  ].filter(Boolean) as [string, string][];
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeMemberTab, setActiveMemberTab] = useState<"skill" | "academic">("skill");
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const summary = useMemo(() => (response ? filterEntries(response.filters) : []), [response]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { x: number; y: number };
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setPosition(parsed);
      }
    } catch {
      // Ignore invalid local storage state.
    }
  }, []);

  useEffect(() => {
    if (!position) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (!dragRef.current) return;
      const nextX = Math.max(DEFAULT_GAP, dragRef.current.baseX + (event.clientX - dragRef.current.startX));
      const nextY = Math.max(DEFAULT_GAP, dragRef.current.baseY + (event.clientY - dragRef.current.startY));
      setPosition({ x: nextX, y: nextY });
    }

    function handleUp() {
      dragRef.current = null;
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  function beginDrag(event: ReactPointerEvent) {
    const currentX =
      position?.x ?? Math.max(DEFAULT_GAP, window.innerWidth - (expanded ? 760 : 144) - DEFAULT_GAP);
    const currentY =
      position?.y ??
      Math.max(DEFAULT_GAP, window.innerHeight - (open ? (expanded ? (82 * window.innerHeight) / 100 : 620) : 144) - DEFAULT_GAP);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: currentX,
      baseY: currentY,
    };
  }

  const launcherStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" as const }
    : undefined;
  const panelWidth = expanded ? 760 : 500;
  const panelHeight = expanded ? "82vh" : "620px";
  const panelStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" as const }
    : undefined;

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;

    setOpen(true);
    setLoading(true);
    setError(null);
    setResponse(null);
    setActiveMemberTab("skill");
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
        className="fixed bottom-4 right-4 z-50 block h-24 w-24 border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition hover:scale-105 focus:outline-none"
        style={launcherStyle}
        onClick={() => setOpen(true)}
        onPointerDown={beginDrag}
        title="AI 인재검색 Agent 열기"
      >
        <img
          src="/assets/chatbot-robot-transparent.png"
          alt="AI 인재검색 Agent"
          className="h-full w-full object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.28)]"
        />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 border border-sk-orange/30 bg-[#FFF8F1] shadow-2xl"
      style={{ ...panelStyle, width: panelWidth, height: panelHeight }}
    >
      <div
        className="flex cursor-move items-center gap-3 border-b border-sk-orange/25 bg-[#FFF3E5] px-4 py-3"
        onPointerDown={beginDrag}
      >
        <img src="/assets/chatbot-robot-transparent.png" alt="" className="h-11 w-11 object-contain" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold text-text-main">AI 인재검색 Agent</div>
          <div className="text-[14px] leading-snug text-text-muted">
            후보 추천, 개인 Skill 조회, 즉석 Skill Dashboard를 한 번에 제공합니다.
          </div>
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
            <div className="font-bold">후보 추천뿐 아니라 특정 구성원의 Skill 현황도 바로 조회할 수 있습니다.</div>
            <div className="mt-1 text-text-muted">
              스킬, 팀, R/L, 직책, 경험 키워드나 구성원 이름을 자연어로 입력하면 내부 데이터 기준으로 근거를 바로 보여줍니다.
            </div>
          </div>

          {lastQuestion && (
            <div className="ml-auto max-w-[86%] bg-sk-orange px-4 py-3 text-sm font-semibold text-white">{lastQuestion}</div>
          )}

          {loading && (
            <div className="border border-border-soft bg-white px-4 py-3 text-sm text-text-muted">
              후보 데이터와 Skill Profile을 확인하는 중입니다...
            </div>
          )}

          {error && <div className="border border-sk-red bg-white px-4 py-3 text-sm leading-relaxed text-sk-red">{error}</div>}

          {response && (
            <div className="space-y-3">
              {response.filters.member_name && response.memberAcademic && (
                <div className="border border-sk-orange/25 bg-white">
                  <div className="flex border-b border-border-soft">
                    <button
                      className={`px-4 py-2 text-sm font-bold ${activeMemberTab === "skill" ? "bg-[#FFF3E5] text-text-main" : "text-text-muted"}`}
                      onClick={() => setActiveMemberTab("skill")}
                      type="button"
                    >
                      Skill 요약
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-bold ${activeMemberTab === "academic" ? "bg-[#FFF3E5] text-text-main" : "text-text-muted"}`}
                      onClick={() => setActiveMemberTab("academic")}
                      type="button"
                    >
                      {response.memberAcademic.title}
                    </button>
                  </div>
                  {activeMemberTab === "academic" && (
                    <div className="px-4 py-3">
                      <div className="text-xs leading-relaxed text-text-muted">{response.memberAcademic.note}</div>
                      <div className="mt-3 grid gap-2">
                        {response.memberAcademic.items.map((item) => (
                          <div key={item.label} className="grid grid-cols-[96px_1fr] gap-3 border border-border-soft bg-[#FFF8F1] px-3 py-2">
                            <div className="text-xs font-bold text-text-muted">{item.label}</div>
                            <div className="text-sm text-text-main">{item.value}</div>
                          </div>
                        ))}
                      </div>
                      {response.memberAcademic.sections && response.memberAcademic.sections.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {response.memberAcademic.sections.map((section) => (
                            <div key={section.title} className="border border-border-soft bg-white">
                              <div className="flex items-center justify-between gap-3 border-b border-border-soft px-3 py-2">
                                <div className="text-sm font-bold text-text-main">{section.title}</div>
                                <div className="text-[11px] font-bold text-text-muted uppercase">{section.status}</div>
                              </div>
                              <div className="px-3 py-3">
                                {section.note && <div className="mb-2 text-xs leading-relaxed text-text-muted">{section.note}</div>}
                                <div className="grid gap-2">
                                  {section.items.map((item) => (
                                    <div key={`${section.title}-${item.label}`} className="grid grid-cols-[96px_1fr] gap-3 bg-[#FFF8F1] px-3 py-2">
                                      <div className="text-xs font-bold text-text-muted">{item.label}</div>
                                      <div className="text-sm text-text-main">{item.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {response.dashboard && activeMemberTab === "skill" && (
                <div className="border border-sk-orange/25 bg-white px-4 py-3">
                  <div className="text-sm font-extrabold text-text-main">{response.dashboard.title}</div>
                  <div className="mt-1 text-xs text-text-muted">{response.dashboard.subtitle}</div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {response.dashboard.metrics.map((metric) => (
                      <div key={metric.label} className="border border-border-soft bg-[#FFF8F1] px-3 py-2">
                        <div className="text-[10px] font-bold uppercase text-text-muted">{metric.label}</div>
                        <div className="mt-1 text-lg font-extrabold text-text-main">{metric.value}</div>
                        {metric.note && <div className="mt-0.5 text-[10px] text-text-muted">{metric.note}</div>}
                      </div>
                    ))}
                  </div>

                  {response.dashboard.teamAverages.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold text-text-main">팀별 후보 평균 Level</div>
                      <div className="space-y-2">
                        {response.dashboard.teamAverages.map((bar, index) => (
                          <div key={bar.label} className="grid grid-cols-[96px_1fr_72px] items-center gap-2">
                            <div className="truncate text-xs font-semibold text-text-main">{bar.label}</div>
                            <div className="h-2.5 bg-bg-main">
                              <div
                                className="h-2.5"
                                style={{
                                  width: `${Math.max((bar.value / 4) * 100, 2)}%`,
                                  background: BAR_COLORS[index % BAR_COLORS.length],
                                }}
                              />
                            </div>
                            <div className="text-right text-xs font-bold text-text-main">{bar.displayValue}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {response.dashboard.insights.length > 0 && (
                    <div className="mt-4 grid gap-2">
                      {response.dashboard.insights.map((insight) => (
                        <div key={insight.title} className="border-l-2 border-sk-orange bg-[#FFF8F1] px-3 py-2">
                          <div className="text-xs font-extrabold text-text-main">{insight.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{insight.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeMemberTab === "skill" && (
                <div className="border border-border-soft bg-white px-4 py-3">
                  <div className="text-sm font-extrabold text-text-main">분석 요약</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-main">{response.answer}</p>
                </div>
              )}

              {summary.length > 0 && activeMemberTab === "skill" && (
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

              {response.results.length > 0 && activeMemberTab === "skill" && (
                <div className="border border-border-soft bg-white">
                  <div className="border-b border-border-soft px-4 py-2 text-sm font-extrabold text-text-main">
                    {response.filters.member_name ? "조회 결과" : `추천 후보 ${response.totalCount}명`}
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
                          {row.matched.length > 0
                            ? row.matched.map((skill) => `${skill.skill_name} L${skill.level.toFixed(1)}`).join(", ")
                            : "직무/KPI 과제 키워드 기준 후보"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {response.docEvidence.length > 0 && activeMemberTab === "skill" && (
                <div className="border border-border-soft bg-white px-4 py-3">
                  <div className="mb-2 text-sm font-extrabold text-text-main">근거 데이터</div>
                  <div className="space-y-2">
                    {response.docEvidence.slice(0, 4).map((evidence, index) => (
                      <div key={`${evidence.file}-${index}`} className="border border-border-soft bg-bg-main/50 px-3 py-2">
                        <div className="text-[11px] font-bold text-text-main">
                          {evidence.file} · {evidence.loc}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-text-muted">{evidence.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {response.followUpSuggestions.length > 0 && activeMemberTab === "skill" && (
                <div className="border border-border-soft bg-white px-4 py-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-text-muted">다음 질문</div>
                  <div className="flex flex-wrap gap-2">
                    {response.followUpSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        className="border border-sk-orange/30 bg-[#FFF8F1] px-2.5 py-1.5 text-left text-xs text-text-main hover:bg-sk-orange/[0.08]"
                        onClick={() => {
                          setQuestion(suggestion);
                          void ask(suggestion);
                        }}
                      >
                        {suggestion}
                      </button>
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
                className="border border-sk-orange/30 bg-white px-3 py-1.5 text-[13px] text-text-main hover:bg-sk-orange/[0.08]"
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
              placeholder="예: 김선재의 보유 Skill / OLED 설계 후보 / GC 분석 L3 이상"
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

