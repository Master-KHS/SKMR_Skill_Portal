"use client";

import { useMemo, useState } from "react";
import { usePersona } from "@/components/PersonaContext";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import type { Member } from "@/lib/types";

interface EvalRow {
  employee_id: string;
  name: string;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  n1Id: string | null;
  n1Name: string | null;
  n2Id: string | null;
  n2Name: string | null;
}

const EVALUABLE_JOB_TYPES = ["사무직", "기술직", "연구직"];
const DIVISION_LEAD_POSITIONS = ["담당", "임원", "대표", "위원"];
const EXECUTIVE_POSITIONS = ["대표", "위원", "임원"];

function findFirst(members: Member[], predicate: (candidate: Member) => boolean) {
  return members.find(predicate) ?? null;
}

function getEvaluators(member: Member, members: Member[]) {
  const sameTeam = (candidate: Member) =>
    candidate.team === member.team && candidate.employee_id !== member.employee_id;
  const sameDivision = (candidate: Member) =>
    candidate.division === member.division && candidate.employee_id !== member.employee_id;
  const isExecutive = (candidate: Member) =>
    (candidate.job_type === "경영" || EXECUTIVE_POSITIONS.includes(candidate.position ?? "")) &&
    candidate.employee_id !== member.employee_id;

  if (member.position === "팀원") {
    const n1 = findFirst(members, (candidate) => sameTeam(candidate) && candidate.position === "팀장");
    const n2 =
      findFirst(members, (candidate) => sameDivision(candidate) && DIVISION_LEAD_POSITIONS.includes(candidate.position ?? "")) ??
      findFirst(members, isExecutive);
    return { n1, n2 };
  }

  if (member.position === "팀장") {
    const n1 =
      findFirst(members, (candidate) => sameDivision(candidate) && DIVISION_LEAD_POSITIONS.includes(candidate.position ?? "")) ??
      findFirst(members, isExecutive);
    const n2 = findFirst(members, isExecutive);
    return { n1, n2 };
  }

  if (DIVISION_LEAD_POSITIONS.includes(member.position ?? "")) {
    const n1 = findFirst(members, isExecutive);
    return { n1, n2: null };
  }

  const n1 = findFirst(members, (candidate) => sameTeam(candidate) && candidate.position === "팀장");
  const n2 =
    findFirst(members, (candidate) => sameDivision(candidate) && DIVISION_LEAD_POSITIONS.includes(candidate.position ?? "")) ??
    findFirst(members, isExecutive);
  return { n1, n2 };
}

export function EvalLinesClient({ members }: { members: Member[] }) {
  const { persona, currentMember } = usePersona();
  const [divisionFilter, setDivisionFilter] = useState("");
  const [keyword, setKeyword] = useState("");

  const evaluable = useMemo(
    () => members.filter((member) => EVALUABLE_JOB_TYPES.includes(member.job_type ?? "")),
    [members]
  );

  const scoped = useMemo(() => {
    if (persona === "team_leader" && currentMember) {
      return evaluable.filter((member) => member.team === currentMember.team);
    }
    if (persona === "calibration" && currentMember) {
      return evaluable.filter((member) => member.division === currentMember.division);
    }
    if (persona === "employee" && currentMember) {
      return evaluable.filter((member) => member.employee_id === currentMember.employee_id);
    }
    return evaluable;
  }, [currentMember, evaluable, persona]);

  const rows = useMemo<EvalRow[]>(
    () =>
      scoped.map((member) => {
        const { n1, n2 } = getEvaluators(member, members);
        return {
          employee_id: member.employee_id,
          name: member.name,
          division: member.division,
          team: member.team,
          role_level: member.role_level,
          position: member.position,
          n1Id: n1?.employee_id ?? null,
          n1Name: n1?.name ?? null,
          n2Id: n2?.employee_id ?? null,
          n2Name: n2?.name ?? null,
        };
      }),
    [members, scoped]
  );

  const divisions = useMemo(
    () => [...new Set(rows.map((row) => row.division).filter(Boolean))] as string[],
    [rows]
  );

  const view = rows.filter((row) => {
    if (divisionFilter && row.division !== divisionFilter) return false;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      if (!row.name.toLowerCase().includes(kw) && !row.employee_id.toLowerCase().includes(kw)) return false;
    }
    return true;
  });

  const n1Missing = view.filter((row) => !row.n1Id).length;
  const n2Missing = view.filter((row) => !row.n2Id).length;

  return (
    <div>
      <PageHeader
        title="Assessment 라인 관리"
        desc="구성원별 자동 평가 라인 매핑을 N+1, N+2 기준으로 확인합니다."
      />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-text-muted">담당</span>
            <select
              className="mt-1 w-full border border-border-soft bg-white px-2 py-1.5 text-sm"
              value={divisionFilter}
              onChange={(event) => setDivisionFilter(event.target.value)}
            >
              <option value="">전체</option>
              {divisions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-text-muted">이름 / 사번 검색</span>
            <input
              className="mt-1 w-full border border-border-soft bg-white px-2 py-1.5 text-sm"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="예: 김수현, EMP005"
            />
          </label>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <Stat label="매핑 대상" value={`${view.length} / ${rows.length}`} accent />
        <Stat label="N+1 누락" value={n1Missing} />
        <Stat label="N+2 누락" value={n2Missing} />
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="py-2 pr-3">사번</th>
              <th className="py-2 pr-3">이름</th>
              <th className="py-2 pr-3">담당</th>
              <th className="py-2 pr-3">팀</th>
              <th className="py-2 pr-3">R/L</th>
              <th className="py-2 pr-3">직책</th>
              <th className="py-2 pr-3">N+1 평가자</th>
              <th className="py-2">N+2 평가자</th>
            </tr>
          </thead>
          <tbody>
            {view.map((row) => (
              <tr key={row.employee_id} className="border-b border-border-soft">
                <td className="py-2 pr-3 font-mono text-xs">{row.employee_id}</td>
                <td className="py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3">{row.division ?? "-"}</td>
                <td className="py-2 pr-3">{row.team ?? "-"}</td>
                <td className="py-2 pr-3">{row.role_level ?? "-"}</td>
                <td className="py-2 pr-3">{row.position ?? "-"}</td>
                <td className="py-2 pr-3">
                  {row.n1Id ? `${row.n1Name} (${row.n1Id})` : <Badge tone="warning" label="미매핑" />}
                </td>
                <td className="py-2">
                  {row.n2Id ? `${row.n2Name} (${row.n2Id})` : <Badge tone="warning" label="미매핑" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {(n1Missing > 0 || n2Missing > 0) && (
        <div className="mt-3 text-xs text-text-muted">
          누락 건은 현재 members 데이터에 상위 평가자 직책이 없거나, division/team 구조가 끊긴 경우입니다.
        </div>
      )}
    </div>
  );
}
