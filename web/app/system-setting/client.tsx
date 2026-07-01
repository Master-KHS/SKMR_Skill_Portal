"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { NAV_ITEMS, PERSONA_LABELS } from "@/lib/nav";
import type { PersonaCode } from "@/lib/types";

const PERSONAS: PersonaCode[] = ["employee", "team_leader", "calibration", "committee", "hr_admin", "hr_viewer", "executive"];

interface SkillRow { skill_id: number; skill_name: string; is_critical: number; sub_family_name: string }
interface Counts { member: number; skill: number; skill_profile: number; required_skill: number; assessment: number; evidence: number; critical: number }

export function SystemSettingClient() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [kw, setKw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin").then((r) => r.json());
    setCounts(d.counts); setSkills(d.skills);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(skill_id: number, value: boolean) {
    setSkills((s) => s.map((x) => x.skill_id === skill_id ? { ...x, is_critical: value ? 1 : 0 } : x));
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleCritical", skill_id, value }) });
    load();
  }
  async function reset() {
    if (!confirm("모든 입력 데이터를 초기 시드 상태로 되돌립니다. 계속할까요?")) return;
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) });
    setMsg("DB를 초기 시드 상태로 리셋했습니다."); load();
  }

  const filtered = kw.trim() ? skills.filter((s) => s.skill_name.toLowerCase().includes(kw.trim().toLowerCase())) : skills;

  return (
    <div>
      <PageHeader title="Admin 권한 관리" desc="시스템 정보 · Critical Skill 지정 · 권한 매트릭스 · DB 리셋 (HR Admin 전용)" />
      {msg && <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      {counts && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-3">
            <Stat label="구성원" value={counts.member} accent />
            <Stat label="Skill" value={counts.skill} />
            <Stat label="Profile" value={counts.skill_profile} />
            <Stat label="Critical 지정" value={counts.critical} />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Required 매핑" value={counts.required_skill} />
            <Stat label="Assessment 이력" value={counts.assessment} />
            <Stat label="Evidence" value={counts.evidence} />
          </div>
        </>
      )}

      <Card title="Critical Skill 지정" className="mb-6">
        <input className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mb-3" placeholder="스킬명 검색" value={kw} onChange={(e) => setKw(e.target.value)} />
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="py-1.5 w-16">Critical</th><th className="py-1.5 pr-2">Skill</th><th className="py-1.5">Sub-family</th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.skill_id} className="border-b border-border-soft">
                  <td className="py-1"><input type="checkbox" checked={!!s.is_critical} onChange={(e) => toggle(s.skill_id, e.target.checked)} /></td>
                  <td className="py-1 pr-2">#{String(s.skill_id).padStart(3, "0")} {s.skill_name}{s.is_critical ? <span className="ml-1"><Badge tone="danger" label="CRT" /></span> : null}</td>
                  <td className="py-1 text-text-muted">{s.sub_family_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="페르소나별 메뉴 권한 매트릭스" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b-2 border-border-soft text-text-muted">
              <th className="py-2 pr-3 text-left">메뉴</th>
              {PERSONAS.map((p) => <th key={p} className="py-2 px-2 text-center whitespace-nowrap">{PERSONA_LABELS[p]}</th>)}
            </tr></thead>
            <tbody>
              {NAV_ITEMS.map((item) => (
                <tr key={item.key} className="border-b border-border-soft">
                  <td className="py-1.5 pr-3"><span className="text-text-muted">[{item.section}]</span> {item.title}</td>
                  {PERSONAS.map((p) => <td key={p} className="py-1.5 px-2 text-center">{item.visibility[p] ? <span className="text-success font-bold">O</span> : <span className="text-border-soft">·</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="DB 관리">
        <div className="flex items-center gap-3">
          <button className="border border-sk-red text-sk-red px-4 py-1.5 text-sm font-bold" onClick={reset}>초기 시드로 리셋</button>
          <span className="text-xs text-text-muted">모든 입력(진단·평가·근거·생성인원)을 지우고 기본 데이터로 되돌립니다.</span>
        </div>
      </Card>
    </div>
  );
}
