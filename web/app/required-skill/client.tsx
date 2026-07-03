"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersona } from "@/components/PersonaContext";
import { Badge, Card, PageHeader } from "@/components/ui";

interface Req {
  org_or_individual: string;
  target_id: string;
  skill_id: number;
  target_level: number;
  is_core: number;
  status: string;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
}

interface SkillOpt {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
}

interface Data {
  rows: Req[];
  skills: SkillOpt[];
  teams: string[];
  members: { employee_id: string; name: string; team: string }[];
  permissions: {
    canEditCompany: boolean;
    canEditDepartment: boolean;
    canRequestIndividual: boolean;
    canApproveIndividual: boolean;
  };
}

interface DashboardData {
  teamCoreStatus: {
    team: string;
    nTeam: number;
    skills: { skill_id: number; skill_name: string; target_level: number; avg_lv: number; holders: number }[];
  }[];
}

type Tab = "company" | "department" | "individual";

function levelColor(level: number) {
  if (level >= 3) return "#16A34A";
  if (level >= 2.5) return "#2563EB";
  if (level >= 2) return "#F59E0B";
  return "#EA002C";
}

function LevelScale({ current, target }: { current: number; target: number }) {
  const currentPct = Math.min(100, Math.max(0, (current / 4) * 100));
  const targetPct = Math.min(100, Math.max(0, (target / 4) * 100));
  const gapWidth = Math.max(0, targetPct - currentPct);

  return (
    <div className="pt-4">
      <div className="relative mb-1 h-4">
        {[1, 2, 3, 4].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 -translate-x-1/2 text-[10px] font-extrabold text-text-muted"
            style={{ left: `${(mark / 4) * 100}%` }}
          >
            {mark}
          </div>
        ))}
      </div>
      <div className="relative h-2.5 bg-white">
        {[1, 2, 3, 4].map((mark) => (
          <div
            key={mark}
            className="absolute top-[-5px] h-5 w-px bg-border-soft"
            style={{ left: `${(mark / 4) * 100}%` }}
          />
        ))}
        <div className="absolute left-0 top-0 h-2.5" style={{ width: `${currentPct}%`, background: levelColor(current) }} />
        {gapWidth > 0 && <div className="absolute top-0 h-2.5 bg-[#B8C0CC]" style={{ left: `${currentPct}%`, width: `${gapWidth}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-text-muted">
        <span>현재 L{current.toFixed(1)}</span>
        <span>요구 L{target.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function RequiredSkillClient() {
  const { persona, currentMember } = usePersona();
  const [data, setData] = useState<Data | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("company");
  const [team, setTeam] = useState("");
  const [member, setMember] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      persona,
      actor_id: currentMember?.employee_id ?? "",
    });
    const [d, dash] = await Promise.all([
      fetch(`/api/required?${params.toString()}`).then((r) => r.json()) as Promise<Data>,
      fetch("/api/dashboard").then((r) => r.json()) as Promise<DashboardData>,
    ]);
    setData(d);
    setDashboard(dash);
    setTeam((prev) => prev || d.teams[0] || "");
    setMember((prev) => prev || d.members[0]?.employee_id || "");
  }, [currentMember?.employee_id, persona]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: object) {
    const res = await fetch("/api/required", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        persona,
        actor_id: currentMember?.employee_id ?? "",
      }),
    });
    return res.json();
  }

  if (!data) return <div className="text-sm text-text-muted">불러오는 중..</div>;

  const tabs = [
    { key: "company" as const, label: "전사" },
    { key: "department" as const, label: "조직별" },
    { key: "individual" as const, label: "개인별" },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader title="필요 Skill 정의" desc="전사, 조직, 개인 범위의 Required Skill과 개인 요청/승인 흐름" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="text-sm font-semibold text-text-main">Core Skill 운영</div>
            <div className="text-xs text-text-muted">
              적용 구조: 전사 Core + 팀별 Core + 개인 승인 Skill. 엑셀은 전체 인원별 Core 요구/현재 Level/Gap을 내려받습니다.
            </div>
          </div>
          {persona === "hr_admin" && (
            <button
              className="border border-sk-orange px-3 py-1.5 text-sm font-semibold text-[#C45E00]"
              onClick={async () => {
                const result = await post({ action: "seedTeamCoreDummy" });
                if (result.ok) {
                  setMsg(`팀별 Core 더미 ${result.saved}개 팀 적용 완료`);
                  load();
                } else {
                  setMsg(result.error ?? "팀별 Core 더미 적용 실패");
                }
              }}
            >
              팀별 Core 더미 적용
            </button>
          )}
          <a
            className="bg-sk-orange px-3 py-1.5 text-sm font-bold text-white"
            href="/api/required/export"
          >
            Core Skill 엑셀 다운로드
          </a>
        </div>
      </Card>

      <div className="mb-4 flex gap-1 border-b border-border-soft">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setTab(item.key);
              setMsg(null);
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === item.key ? "border-sk-red text-sk-red" : "border-transparent text-text-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-3 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>}

      <RequiredStatusPanel data={data} dashboard={dashboard} tab={tab} team={team} member={member} />

      {tab === "company" && (
        <ScopeEditor
          title="전사 공통 필요 Skill"
          data={data}
          orgKind="company"
          targetId="ALL"
          editable={data.permissions.canEditCompany}
          onSaved={(message) => {
            setMsg(message);
            load();
          }}
          post={post}
          enforceCoreFive={false}
        />
      )}

      {tab === "department" && (
        <div>
          <label className="mr-2 text-sm text-text-muted">팀</label>
          <select className="mb-4 border border-border-soft bg-white px-3 py-1.5 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>
            {data.teams.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ScopeEditor
            key={team}
            title={`${team} 필요 Skill`}
            data={data}
            orgKind="department"
            targetId={team}
            editable={data.permissions.canEditDepartment}
            onSaved={(message) => {
              setMsg(message);
              load();
            }}
            post={post}
            enforceCoreFive
          />
        </div>
      )}

      {tab === "individual" && (
        <IndividualPanel
          data={data}
          member={member}
          setMember={setMember}
          canRequest={data.permissions.canRequestIndividual}
          canApprove={data.permissions.canApproveIndividual}
          onChanged={(message) => {
            setMsg(message);
            load();
          }}
          post={post}
        />
      )}
    </div>
  );
}

function RequiredStatusPanel({
  data,
  dashboard,
  tab,
  team,
  member,
}: {
  data: Data;
  dashboard: DashboardData | null;
  tab: Tab;
  team: string;
  member: string;
}) {
  if (tab === "company") {
    const rows = data.rows.filter((row) => row.org_or_individual === "company" && row.target_id === "ALL" && row.status === "approved");
    const coreCount = rows.filter((row) => row.is_core).length;
    const avgTarget = rows.length ? rows.reduce((sum, row) => sum + row.target_level, 0) / rows.length : 0;

    return (
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-xs font-bold text-text-muted">전사 필수 Skill</div>
          <div className="mt-1 text-2xl font-extrabold text-text-main">{rows.length}개</div>
        </Card>
        <Card>
          <div className="text-xs font-bold text-text-muted">Core 지정</div>
          <div className="mt-1 text-2xl font-extrabold text-text-main">{coreCount}개</div>
        </Card>
        <Card>
          <div className="text-xs font-bold text-text-muted">평균 요구 Level</div>
          <div className="mt-1 text-2xl font-extrabold text-text-main">L{avgTarget.toFixed(1)}</div>
        </Card>
      </div>
    );
  }

  if (tab === "department") {
    const core = dashboard?.teamCoreStatus.find((row) => row.team === team);
    const avgCurrent = core?.skills.length
      ? core.skills.reduce((sum, skill) => sum + skill.avg_lv, 0) / core.skills.length
      : 0;

    return (
      <Card title={`${team || "조직"} Core Skill 평균 Level`} className="mb-4">
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="border border-border-soft bg-bg-main/50 px-3 py-2">
            <div className="text-xs font-bold text-text-muted">팀 인원</div>
            <div className="mt-1 text-xl font-extrabold text-text-main">{core?.nTeam ?? 0}명</div>
          </div>
          <div className="border border-border-soft bg-bg-main/50 px-3 py-2">
            <div className="text-xs font-bold text-text-muted">Core Skill</div>
            <div className="mt-1 text-xl font-extrabold text-text-main">{core?.skills.length ?? 0}개</div>
          </div>
          <div className="border border-border-soft bg-bg-main/50 px-3 py-2">
            <div className="text-xs font-bold text-text-muted">현재 평균 Level</div>
            <div className="mt-1 text-xl font-extrabold text-text-main">L{avgCurrent.toFixed(1)}</div>
          </div>
        </div>
        {!core || core.skills.length === 0 ? (
          <div className="text-sm text-text-muted">등록된 조직 Core Skill이 없습니다.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {core.skills.map((skill) => (
              <div key={skill.skill_id} className="border border-border-soft bg-bg-main/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-text-main">{skill.skill_name}</div>
                    <div className="text-xs text-text-muted">보유 {skill.holders}명</div>
                  </div>
                  <Badge tone={skill.avg_lv >= skill.target_level ? "success" : "warning"} label={skill.avg_lv >= skill.target_level ? "충족" : "보완"} />
                </div>
                <LevelScale current={skill.avg_lv} target={skill.target_level} />
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const mine = data.rows.filter((row) => row.org_or_individual === "individual" && row.target_id === member);
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <Card>
        <div className="text-xs font-bold text-text-muted">승인 개인 Skill</div>
        <div className="mt-1 text-2xl font-extrabold text-text-main">{mine.filter((row) => row.status === "approved").length}개</div>
      </Card>
      <Card>
        <div className="text-xs font-bold text-text-muted">승인 대기</div>
        <div className="mt-1 text-2xl font-extrabold text-text-main">{mine.filter((row) => row.status === "pending").length}개</div>
      </Card>
      <Card>
        <div className="text-xs font-bold text-text-muted">평균 요구 Level</div>
        <div className="mt-1 text-2xl font-extrabold text-text-main">
          L{mine.length ? (mine.reduce((sum, row) => sum + row.target_level, 0) / mine.length).toFixed(1) : "0.0"}
        </div>
      </Card>
    </div>
  );
}

function ScopeEditor({
  title,
  data,
  orgKind,
  targetId,
  editable,
  enforceCoreFive,
  onSaved,
  post,
}: {
  title: string;
  data: Data;
  orgKind: string;
  targetId: string;
  editable: boolean;
  enforceCoreFive: boolean;
  onSaved: (message: string) => void;
  post: (body: object) => Promise<{ ok?: boolean; saved?: number; error?: string }>;
}) {
  const initial = data.rows.filter((row) => row.org_or_individual === orgKind && row.target_id === targetId && row.status === "approved");
  const [rows, setRows] = useState(initial.map((row) => ({ skill_id: row.skill_id, target_level: row.target_level, is_core: !!row.is_core })));
  const [addId, setAddId] = useState<number | "">("");
  const skillName = useMemo(() => new Map(data.skills.map((skill) => [skill.skill_id, skill.skill_name])), [data.skills]);
  const usedIds = new Set(rows.map((row) => row.skill_id));
  const coreCount = rows.filter((row) => row.is_core).length;

  return (
    <Card title={title}>
      {enforceCoreFive && (
        <div className={`mb-3 border p-2 text-xs ${coreCount === 5 ? "border-success bg-success/[0.06] text-success" : "border-warning bg-warning/[0.08] text-[#9A6500]"}`}>
          Core는 정확히 5개여야 저장됩니다. 현재 {coreCount}개
        </div>
      )}

      <table className="mb-3 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border-soft text-left text-text-muted">
            <th className="py-2 pr-3">Skill</th>
            <th className="w-28 py-2 pr-3">목표 Level</th>
            <th className="w-20 py-2 pr-3">Core</th>
            <th className="w-16 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-xs text-text-muted">
                등록된 필요 Skill이 없습니다.
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={row.skill_id} className="border-b border-border-soft">
              <td className="py-1.5 pr-3">#{String(row.skill_id).padStart(3, "0")} {skillName.get(row.skill_id)}</td>
              <td className="py-1.5 pr-3">
                <select
                  className="border border-border-soft px-2 py-1 text-sm"
                  value={row.target_level}
                  disabled={!editable}
                  onChange={(e) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, target_level: Number(e.target.value) } : item))}
                >
                  {[1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>L{level}</option>
                  ))}
                </select>
              </td>
              <td className="py-1.5 pr-3">
                <input
                  type="checkbox"
                  checked={row.is_core}
                  disabled={!editable}
                  onChange={(e) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, is_core: e.target.checked } : item))}
                />
              </td>
              <td className="py-1.5">
                {editable && <button className="text-xs text-sk-red" onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editable && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <select className="flex-1 border border-border-soft bg-white px-2 py-1.5 text-sm" value={addId} onChange={(e) => setAddId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">+ Skill 추가 선택</option>
              {data.skills.filter((skill) => !usedIds.has(skill.skill_id)).map((skill) => (
                <option key={skill.skill_id} value={skill.skill_id}>
                  #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name} ({skill.sub_family_name})
                </option>
              ))}
            </select>
            <button
              className="border border-sk-orange px-3 py-1.5 text-sm font-medium text-[#C45E00]"
              disabled={addId === ""}
              onClick={() => {
                if (addId === "") return;
                setRows((current) => [...current, { skill_id: addId, target_level: 2, is_core: false }]);
                setAddId("");
              }}
            >
              추가
            </button>
          </div>
          <button
            className="bg-sk-orange px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
            disabled={enforceCoreFive && coreCount !== 5}
            onClick={async () => {
              const result = await post({ action: "saveScope", org_kind: orgKind, target_id: targetId, rows });
              if (result.ok) onSaved(`${result.saved}건 저장 완료`);
            }}
          >
            저장
          </button>
        </>
      )}
    </Card>
  );
}

function IndividualPanel({
  data,
  member,
  setMember,
  canRequest,
  canApprove,
  onChanged,
  post,
}: {
  data: Data;
  member: string;
  setMember: (value: string) => void;
  canRequest: boolean;
  canApprove: boolean;
  onChanged: (message: string) => void;
  post: (body: object) => Promise<{ ok?: boolean; error?: string; status?: string }>;
}) {
  const [addId, setAddId] = useState<number | "">("");
  const mine = data.rows.filter((row) => row.org_or_individual === "individual" && row.target_id === member);
  const approved = mine.filter((row) => row.status === "approved");
  const pending = mine.filter((row) => row.status === "pending");
  const usedIds = new Set(mine.map((row) => row.skill_id));

  return (
    <div>
      <label className="mr-2 text-sm text-text-muted">구성원</label>
      <select className="mb-4 border border-border-soft bg-white px-3 py-1.5 text-sm" value={member} onChange={(e) => setMember(e.target.value)}>
        {data.members.map((item) => (
          <option key={item.employee_id} value={item.employee_id}>
            {item.name} ({item.team})
          </option>
        ))}
      </select>

      {canRequest && (
        <Card title="개인 Skill 요청" className="mb-4">
          <div className="flex items-center gap-2">
            <select className="flex-1 border border-border-soft bg-white px-2 py-1.5 text-sm" value={addId} onChange={(e) => setAddId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Skill 선택</option>
              {data.skills.filter((skill) => !usedIds.has(skill.skill_id)).map((skill) => (
                <option key={skill.skill_id} value={skill.skill_id}>
                  #{String(skill.skill_id).padStart(3, "0")} {skill.skill_name}
                </option>
              ))}
            </select>
            <button
              className="bg-sk-orange px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40"
              disabled={addId === ""}
              onClick={async () => {
                if (addId === "") return;
                const result = await post({ action: "request", member_id: member, skill_id: addId, target_level: 2 });
                if (result.ok) {
                  setAddId("");
                  onChanged(result.status === "approved" ? "개인 Skill이 즉시 승인되었습니다." : "개인 Skill 요청이 등록되었습니다.");
                } else {
                  onChanged(result.error ?? "요청 실패");
                }
              }}
            >
              요청
            </button>
          </div>
        </Card>
      )}

      <Card title={`승인 대기 (${pending.length})`} className="mb-4">
        {pending.length === 0 ? (
          <div className="text-xs text-text-muted">대기 중인 요청이 없습니다.</div>
        ) : (
          pending.map((row) => (
            <div key={row.skill_id} className="flex items-center gap-2 border-b border-border-soft py-1.5 text-sm">
              <Badge tone="warning" label="대기" />
              <span className="flex-1">#{String(row.skill_id).padStart(3, "0")} {row.skill_name} / 목표 L{row.target_level}</span>
              {canApprove ? (
                <>
                  <button className="border border-success px-2 py-0.5 text-xs text-success" onClick={async () => { await post({ action: "approve", member_id: member, skill_id: row.skill_id }); onChanged("승인됨"); }}>승인</button>
                  <button className="border border-sk-red px-2 py-0.5 text-xs text-sk-red" onClick={async () => { await post({ action: "reject", member_id: member, skill_id: row.skill_id }); onChanged("반려됨"); }}>반려</button>
                </>
              ) : (
                <button className="border border-border-soft px-2 py-0.5 text-xs text-text-muted" onClick={async () => { await post({ action: "cancel", member_id: member, skill_id: row.skill_id }); onChanged("요청 취소됨"); }}>취소</button>
              )}
            </div>
          ))
        )}
      </Card>

      <Card title={`승인된 개인 필요 Skill (${approved.length})`}>
        {approved.length === 0 ? (
          <div className="text-xs text-text-muted">승인된 개인 Skill이 없습니다.</div>
        ) : (
          approved.map((row) => (
            <div key={row.skill_id} className="flex items-center gap-2 border-b border-border-soft py-1.5 text-sm">
              <Badge tone="success" label="승인" />
              <span className="flex-1">#{String(row.skill_id).padStart(3, "0")} {row.skill_name} / 목표 L{row.target_level}</span>
              {canApprove && (
                <button className="text-xs text-sk-red" onClick={async () => { await post({ action: "removeIndividual", member_id: member, skill_id: row.skill_id }); onChanged("삭제됨"); }}>삭제</button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
