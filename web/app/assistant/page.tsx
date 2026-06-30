"use client";
import { useEffect, useState } from "react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { runAssistant, type AssistantResponse } from "@/lib/assistant";

const EXAMPLES = [
  "GC 분석 L3 이상 보유한 연구직 찾아줘",
  "공정 시뮬레이션 잘하는 사람 추천해줘",
  "소재개발팀에서 OLED 소재 설계 가능한 인재는?",
];

export default function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<AssistantResponse | null>(null);
  const [copied, setCopied] = useState(false);
  // 빌드 시점에 NEXT_PUBLIC_GEMINI_API_KEY가 주입되면 시연용으로 자동 사용.
  const bakedKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
  const [apiKey, setApiKey] = useState(bakedKey);

  useEffect(() => {
    const saved = localStorage.getItem("gemini_key");
    if (saved) setApiKey(saved);
  }, []);

  function saveKey(k: string) {
    setApiKey(k);
    localStorage.setItem("gemini_key", k);
  }

  async function ask(q: string) {
    if (!q.trim()) return;
    if (!apiKey.trim()) {
      setError("Gemini API 키를 먼저 입력하세요. (Google AI Studio에서 무료 발급)");
      return;
    }
    setLoading(true);
    setError(null);
    setResp(null);
    setLastQuestion(q);
    try {
      // 정적 빌드: 브라우저에서 Gemini 직접 호출 (데모용 — 키는 브라우저에만 저장)
      const data = await runAssistant(q, { apiKey });
      setResp(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyAnswer() {
    if (!resp) return;
    navigator.clipboard.writeText(resp.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const verifyBadge = () => {
    if (!resp) return null;
    if (resp.verification === "pass")
      return <Badge tone="success" label="검증: Pass (결과 있음)" />;
    if (resp.verification === "fail")
      return <Badge tone="danger" label="검증: Fail (해당 인원 없음)" />;
    return <Badge tone="warning" label="검증: 확인 필요 (조건 불명확)" />;
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="AI 인재 검색"
        desc="자연어로 질문하면 스킬·인재 DB를 근거로 답합니다 (Gemini 연동)"
      />

      {/* Gemini 키 — 빌드에 탑재되면 입력 불필요, 아니면 직접 입력 */}
      {bakedKey ? (
        <div className="mb-4 border border-success bg-success/[0.06] p-3 flex items-center gap-2">
          <Badge tone="success" label="설정: Gemini 키 탑재됨" />
          <span className="text-xs text-text-muted">시연용으로 키가 내장되어 바로 질문할 수 있습니다.</span>
        </div>
      ) : (
        <div className="mb-4 border border-info bg-info/[0.06] p-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="info" label="설정: Gemini API 키" />
            <span className="text-xs text-text-muted">
              데모 방식 — 키는 이 브라우저에만 저장되며 서버로 전송되지 않습니다.
            </span>
          </div>
          <input
            type="password"
            className="w-full border border-border-soft bg-white px-3 py-2 text-sm focus:border-info focus:outline-none"
            placeholder="AIza... (Google AI Studio에서 무료 발급)"
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
          />
        </div>
      )}

      {/* 질문 입력창 */}
      <Card className="mb-4">
        <div className="flex gap-2">
          <input
            className="flex-1 border border-border-soft bg-white px-3 py-2 text-sm"
            placeholder="예: GC 분석 L3 이상 보유한 연구직 찾아줘"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
          />
          <button
            className="bg-sk-orange text-white px-5 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={() => ask(question)}
            disabled={loading}
          >
            {loading ? "검색 중…" : "질문"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="border border-border-soft px-2 py-1 text-xs text-text-muted hover:border-sk-orange"
              onClick={() => {
                setQuestion(ex);
                ask(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {/* 오류 / 근거부족 안내 (Red/Info) */}
      {error && (
        <div className="border border-sk-red bg-white p-3 text-sm text-sk-red mb-4">
          <span className="font-semibold">오류 · </span>
          {error}
        </div>
      )}

      {resp && (
        <div className="space-y-4">
          {/* 검증 결과 + 의도 */}
          <div className="flex items-center gap-2 flex-wrap">
            {verifyBadge()}
            <Badge tone="info" label={`매칭 인원 ${resp.totalCount}명`} />
            {resp.interpretedIntent && (
              <span className="text-xs text-text-muted">해석: {resp.interpretedIntent}</span>
            )}
          </div>

          {/* 근거 부족 안내 */}
          {!resp.grounded && (
            <div className="border border-warning bg-white p-3 text-sm text-[#9A6500]">
              <span className="font-semibold">근거 부족 · </span>
              검색 조건이 명확하지 않습니다. 스킬명이나 조직/레벨을 더 구체적으로 알려주세요.
            </div>
          )}
          {resp.unresolvedSkills.length > 0 && (
            <div className="border border-warning bg-white p-3 text-sm text-[#9A6500]">
              <span className="font-semibold">매칭 실패 스킬 · </span>
              {resp.unresolvedSkills.join(", ")} — 정확한 스킬명으로 다시 시도해 보세요.
            </div>
          )}

          {/* 답변 영역 */}
          <Card title="답변">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{resp.answer}</p>
            <div className="flex gap-2 mt-4 pt-3 border-t border-border-soft">
              <button
                className="border border-sk-orange text-[#C45E00] px-3 py-1.5 text-xs font-medium"
                onClick={copyAnswer}
              >
                {copied ? "복사됨 ✓" : "답변 복사"}
              </button>
              <button
                className="border border-border-soft px-3 py-1.5 text-xs text-text-muted"
                onClick={() => ask(lastQuestion)}
              >
                다시 질문
              </button>
            </div>
          </Card>

          {/* 출처 목록 (사번/이름/팀) */}
          {resp.sources.length > 0 && (
            <Card title={`출처 — 추천 인재 ${resp.sources.length}명`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border-soft text-left text-text-muted">
                    <th className="py-1.5 pr-3">사번</th>
                    <th className="py-1.5 pr-3">이름</th>
                    <th className="py-1.5 pr-3">조직</th>
                    <th className="py-1.5">매칭 스킬</th>
                  </tr>
                </thead>
                <tbody>
                  {resp.results.map((r) => (
                    <tr key={r.employee_id} className="border-b border-border-soft">
                      <td className="py-1.5 pr-3 font-mono text-xs">{r.employee_id}</td>
                      <td className="py-1.5 pr-3 font-medium">{r.name}</td>
                      <td className="py-1.5 pr-3 text-text-muted">
                        {r.team} · {r.role_level}
                      </td>
                      <td className="py-1.5 text-xs">
                        {r.matched.map((m) => `${m.skill_name} L${m.level}`).join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
