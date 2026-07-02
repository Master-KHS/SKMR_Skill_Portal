"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { PageHeader, Card } from "@/components/ui";
import type { SearchResultRow } from "@/lib/search";

interface Facets {
  divisions: string[];
  teams: string[];
  jobTypes: string[];
  roleLevels: string[];
  positions: string[];
  skills: { id: number; name: string }[];
}

interface SkillCond {
  skill_id: number | "";
  min_level: number;
}

export function TalentSearchClient({ facets }: { facets: Facets }) {
  const [division, setDivision] = useState("");
  const [team, setTeam] = useState("");
  const [jobType, setJobType] = useState("");
  const [roleLevel, setRoleLevel] = useState("");
  const [position, setPosition] = useState("");
  const [conds, setConds] = useState<SkillCond[]>([{ skill_id: "", min_level: 2 }]);
  const [rows, setRows] = useState<SearchResultRow[]>([]);
  const [count, setCount] = useState(0);

  const run = useCallback(async () => {
    const skills = conds
      .filter((cond) => cond.skill_id !== "")
      .map((cond) => ({ skill_id: Number(cond.skill_id), min_level: cond.min_level }));
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        division: division || undefined,
        team: team || undefined,
        job_type: jobType || undefined,
        role_level: roleLevel || undefined,
        position: position || undefined,
        skills,
      }),
    });
    const data = await res.json();
    setRows(data.results ?? []);
    setCount(data.count ?? 0);
  }, [conds, division, jobType, position, roleLevel, team]);

  useEffect(() => {
    run();
  }, [run]);

  const activeConditions = useMemo(
    () => conds.filter((cond) => cond.skill_id !== ""),
    [conds],
  );

  function exportCsv() {
    const header = ["사번", "이름", "담당", "팀", "R/L", "직책", "직종", "보유 Skill", "평균 Level"];
    const body = rows.map((row) => [
      row.employee_id,
      row.name,
      row.division ?? "",
      row.team ?? "",
      row.role_level ?? "",
      row.position ?? "",
      row.job_type ?? "",
      String(row.n_skills),
      String(row.avg_level),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "talent_search.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Talent Search" desc="스킬, 조직, R/L, 직책, 직종 조건을 직접 선택해 후보자를 검색합니다." />

      <Card title="검색 조건" className="mb-4">
        <div className="grid grid-cols-5 gap-3 mb-4">
          <Filter label="담당" value={division} onChange={setDivision} opts={facets.divisions} />
          <Filter label="팀" value={team} onChange={setTeam} opts={facets.teams} />
          <Filter label="직종" value={jobType} onChange={setJobType} opts={facets.jobTypes} />
          <Filter label="R/L" value={roleLevel} onChange={setRoleLevel} opts={facets.roleLevels} />
          <Filter label="직책" value={position} onChange={setPosition} opts={facets.positions} />
        </div>

        <div className="text-xs text-text-muted mb-2">
          보유 Skill 조건은 AND 결합이며, 입력한 모든 조건을 만족하는 인원만 검색합니다.
        </div>
        {conds.map((cond, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <select
              className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full"
              value={cond.skill_id}
              onChange={(event) => {
                const next = [...conds];
                next[index].skill_id = event.target.value === "" ? "" : Number(event.target.value);
                setConds(next);
              }}
            >
              <option value="">(스킬 선택)</option>
              {facets.skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  #{String(skill.id).padStart(3, "0")} {skill.name}
                </option>
              ))}
            </select>
            <select
              className="border border-border-soft bg-white px-2 py-1.5 text-sm w-28"
              value={cond.min_level}
              onChange={(event) => {
                const next = [...conds];
                next[index].min_level = Number(event.target.value);
                setConds(next);
              }}
            >
              {[1, 2, 3, 4].map((level) => (
                <option key={level} value={level}>
                  최소 L{level}
                </option>
              ))}
            </select>
            <button
              className="border border-sk-red text-sk-red px-3 text-sm"
              onClick={() => setConds(conds.filter((_, i) => i !== index))}
            >
              삭제
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <button
            className="border border-border-soft px-3 py-1.5 text-sm text-text-muted"
            onClick={() => setConds([...conds, { skill_id: "", min_level: 2 }])}
          >
            + Skill 조건 추가
          </button>
          <button
            className="border border-border-soft px-3 py-1.5 text-sm text-text-muted"
            onClick={() => setConds([{ skill_id: "", min_level: 2 }])}
          >
            조건 초기화
          </button>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold">
            검색 결과 · <span className="text-sk-orange">{count}명</span>
          </h2>
          {activeConditions.length > 0 && (
            <div className="text-xs text-text-muted mt-1">
              Skill 조건:{" "}
              {activeConditions
                .map((cond) => {
                  const skill = facets.skills.find((item) => item.id === cond.skill_id);
                  return `${skill?.name ?? `#${cond.skill_id}`} ≥ L${cond.min_level}`;
                })
                .join(" · ")}
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <button className="border border-border-soft px-3 py-1.5 text-sm" onClick={exportCsv}>
            검색 결과 CSV 다운로드
          </button>
        )}
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="text-sm text-text-muted py-4">조건에 맞는 인원이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-3">사번</th>
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">담당</th>
                <th className="py-2 pr-3">팀</th>
                <th className="py-2 pr-3">R/L</th>
                <th className="py-2 pr-3">직책</th>
                <th className="py-2 pr-3">직종</th>
                <th className="py-2 pr-3 text-right">보유 Skill</th>
                <th className="py-2 text-right">평균 Level</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee_id} className="border-b border-border-soft">
                  <td className="py-2 pr-3 font-mono text-xs">{row.employee_id}</td>
                  <td className="py-2 pr-3 font-medium">{row.name}</td>
                  <td className="py-2 pr-3">{row.division}</td>
                  <td className="py-2 pr-3">{row.team}</td>
                  <td className="py-2 pr-3">{row.role_level}</td>
                  <td className="py-2 pr-3">{row.position}</td>
                  <td className="py-2 pr-3">{row.job_type}</td>
                  <td className="py-2 pr-3 text-right">{row.n_skills}</td>
                  <td className="py-2 text-right">{row.avg_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted">{label}</span>
      <select
        className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">전체</option>
        {opts.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
