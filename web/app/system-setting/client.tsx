"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { NAV_ITEMS, PERSONA_LABELS } from "@/lib/nav";
import type { PersonaCode } from "@/lib/types";

const PERSONAS: PersonaCode[] = ["employee", "team_leader", "calibration", "committee", "hr_admin", "hr_viewer", "executive"];

interface SkillRow {
  skill_id: number;
  skill_name: string;
  is_critical: number;
  sub_family_name: string;
  family_name: string;
}

interface Counts {
  member: number;
  skill: number;
  skill_profile: number;
  required_skill: number;
  assessment: number;
  evidence: number;
  critical: number;
}

interface FilesMeta {
  dbPath: string;
  dbSizeKb: number;
  membersXlsxPath: string;
  membersXlsxExists: boolean;
}

interface SimulationMeta {
  active: boolean;
  generatedCount: number;
}

interface AdminResponse {
  counts: Counts;
  skills: SkillRow[];
  files: FilesMeta;
  simulation: SimulationMeta;
}

export function SystemSettingClient() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [files, setFiles] = useState<FilesMeta | null>(null);
  const [simulation, setSimulation] = useState<SimulationMeta | null>(null);
  const [kw, setKw] = useState("");
  const [family, setFamily] = useState("");
  const [subFamily, setSubFamily] = useState("");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [target, setTarget] = useState(300);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = (await fetch("/api/admin").then((response) => response.json())) as AdminResponse;
    setCounts(data.counts);
    setSkills(data.skills);
    setFiles(data.files);
    setSimulation(data.simulation);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(skill_id: number, value: boolean) {
    setSkills((current) => current.map((skill) => skill.skill_id === skill_id ? { ...skill, is_critical: value ? 1 : 0 } : skill));
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleCritical", skill_id, value }),
    });
    load();
  }

  async function reset() {
    if (!confirm("모든 입력 데이터를 초기 시드 상태로 되돌릴까요?")) return;
    setBusy("reset");
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    setBusy(null);
    setMsg("DB reset completed and members.xlsx was reapplied.");
    load();
  }

  async function seed(action: "seedTaxonomy" | "seedRequired" | "seedProfiles" | "seedEvidence", message: string) {
    setBusy(action);
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    setMsg(message);
    load();
  }

  async function syncMembers() {
    setBusy("sync");
    await fetch("/api/members");
    setBusy(null);
    setMsg("members.xlsx synchronized to DB.");
    load();
  }

  async function generateSimulation() {
    setBusy("generate");
    const response = await fetch("/api/gen-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const data = await response.json();
    setBusy(null);
    setMsg(data.message ?? `Simulation members updated. Total ${data.total}.`);
    load();
  }

  async function removeSimulation() {
    if (!confirm("G로 시작하는 generated members를 모두 제거할까요?")) return;
    setBusy("remove");
    const response = await fetch("/api/gen-members", { method: "DELETE" });
    const data = await response.json();
    setBusy(null);
    setMsg(data.message ?? `Generated members removed. Total ${data.total}.`);
    load();
  }

  const familyOptions = useMemo(
    () => [...new Set(skills.map((skill) => skill.family_name))],
    [skills]
  );

  const subFamilyOptions = useMemo(
    () => [...new Set(skills.filter((skill) => !family || skill.family_name === family).map((skill) => skill.sub_family_name))],
    [skills, family]
  );

  const filtered = skills.filter((skill) => {
    if (family && skill.family_name !== family) return false;
    if (subFamily && skill.sub_family_name !== subFamily) return false;
    if (onlyCritical && !skill.is_critical) return false;
    if (kw.trim() && !skill.skill_name.toLowerCase().includes(kw.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Admin 권한 관리" desc="시스템 정보, Critical Skill, 권한 매트릭스, 시뮬레이션, DB reset" />
      {msg && <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      {counts && (
        <>
          <div className="mb-3 grid grid-cols-4 gap-4">
            <Stat label="구성원" value={counts.member} accent />
            <Stat label="Skill" value={counts.skill} />
            <Stat label="Profile" value={counts.skill_profile} />
            <Stat label="Critical 지정" value={counts.critical} />
          </div>
          <div className="mb-6 grid grid-cols-4 gap-4">
            <Stat label="Required 매핑" value={counts.required_skill} />
            <Stat label="Assessment 이력" value={counts.assessment} />
            <Stat label="Evidence" value={counts.evidence} />
            <Stat label="Generated" value={simulation?.generatedCount ?? 0} />
          </div>
        </>
      )}

      {files && (
        <Card title="시스템 정보" className="mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="mb-1 text-xs text-text-muted">DB Path</div>
              <code className="block break-all text-xs">{files.dbPath}</code>
            </div>
            <div>
              <div className="mb-1 text-xs text-text-muted">members.xlsx</div>
              <code className="block break-all text-xs">{files.membersXlsxPath}</code>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
            <span>DB Size: {files.dbSizeKb} KB</span>
            <span>XLSX: {files.membersXlsxExists ? "OK" : "Missing"}</span>
          </div>
        </Card>
      )}

      <Card title="시뮬레이션 데이터" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-text-muted">
            {simulation?.active ? `Generated members active: ${simulation.generatedCount}` : "Generated members inactive"}
          </span>
          <input
            type="number"
            min={1}
            max={2000}
            className="w-24 border border-border-soft bg-white px-2 py-1.5 text-sm"
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
          <button
            className="bg-sk-orange px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
            onClick={generateSimulation}
            disabled={busy === "generate"}
          >
            {busy === "generate" ? "생성 중.." : "시뮬레이션 생성"}
          </button>
          <button
            className="border border-sk-red px-4 py-1.5 text-sm font-bold text-sk-red disabled:opacity-40"
            onClick={removeSimulation}
            disabled={busy === "remove"}
          >
            시뮬레이션 제거
          </button>
        </div>
      </Card>

      <Card title="시드 / 동기화" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="border border-border-soft px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            onClick={syncMembers}
            disabled={busy === "sync"}
          >
            {busy === "sync" ? "동기화 중.." : "Members xlsx 동기화"}
          </button>
          <button
            className="border border-sk-red px-4 py-1.5 text-sm font-bold text-sk-red disabled:opacity-40"
            onClick={reset}
            disabled={busy === "reset"}
          >
            {busy === "reset" ? "Reset 중.." : "DB 초기 시드로 리셋"}
          </button>
          <span className="text-xs text-text-muted">
            Reset 후에도 member 데이터는 members.xlsx 기준으로 다시 맞춥니다.
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="border border-border-soft px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            onClick={() => seed("seedTaxonomy", "Skill taxonomy seeded from snapshot.")}
            disabled={busy === "seedTaxonomy"}
          >
            Skill Taxonomy 적재
          </button>
          <button
            className="border border-border-soft px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            onClick={() => seed("seedRequired", "Required skill seed applied.")}
            disabled={busy === "seedRequired"}
          >
            Required Skill 적재
          </button>
          <button
            className="border border-border-soft px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            onClick={() => seed("seedProfiles", "Skill profile seed rebuilt.")}
            disabled={busy === "seedProfiles"}
          >
            Skill Profile 재시드
          </button>
          <button
            className="border border-border-soft px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            onClick={() => seed("seedEvidence", "Evidence seed rebuilt.")}
            disabled={busy === "seedEvidence"}
          >
            Evidence 재시드
          </button>
        </div>
      </Card>

      <Card title="Critical Skill 지정" className="mb-6">
        <div className="mb-3 grid grid-cols-4 gap-3">
          <select
            className="border border-border-soft bg-white px-2 py-1.5 text-sm"
            value={family}
            onChange={(event) => {
              setFamily(event.target.value);
              setSubFamily("");
            }}
          >
            <option value="">전체 Family</option>
            {familyOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="border border-border-soft bg-white px-2 py-1.5 text-sm"
            value={subFamily}
            onChange={(event) => setSubFamily(event.target.value)}
          >
            <option value="">전체 Sub-family</option>
            {subFamilyOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="border border-border-soft bg-white px-2 py-1.5 text-sm"
            placeholder="스킬명 검색"
            value={kw}
            onChange={(event) => setKw(event.target.value)}
          />
          <label className="flex items-center gap-2 border border-border-soft bg-white px-3 py-1.5 text-sm">
            <input type="checkbox" checked={onlyCritical} onChange={(event) => setOnlyCritical(event.target.checked)} />
            Critical만 보기
          </label>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="w-16 py-1.5">Critical</th>
                <th className="py-1.5 pr-2">Skill</th>
                <th className="py-1.5 pr-2">Sub-family</th>
                <th className="py-1.5">Family</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill) => (
                <tr key={skill.skill_id} className="border-b border-border-soft">
                  <td className="py-1">
                    <input
                      type="checkbox"
                      checked={!!skill.is_critical}
                      onChange={(event) => toggle(skill.skill_id, event.target.checked)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name}
                    {skill.is_critical ? <span className="ml-1"><Badge tone="danger" label="CRT" /></span> : null}
                  </td>
                  <td className="py-1 pr-2 text-text-muted">{skill.sub_family_name}</td>
                  <td className="py-1 text-text-muted">{skill.family_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="페르소나별 메뉴 권한 매트릭스" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-soft text-text-muted">
                <th className="py-2 pr-3 text-left">메뉴</th>
                {PERSONAS.map((persona) => (
                  <th key={persona} className="whitespace-nowrap px-2 py-2 text-center">
                    {PERSONA_LABELS[persona]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAV_ITEMS.map((item) => (
                <tr key={item.key} className="border-b border-border-soft">
                  <td className="py-1.5 pr-3">
                    <span className="text-text-muted">[{item.section}]</span> {item.title}
                  </td>
                  {PERSONAS.map((persona) => (
                    <td key={persona} className="px-2 py-1.5 text-center">
                      {item.visibility[persona] ? <span className="font-bold text-success">O</span> : <span className="text-border-soft">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
