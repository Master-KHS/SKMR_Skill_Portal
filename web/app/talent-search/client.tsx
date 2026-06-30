"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card } from "@/components/ui";
import { searchTalent, type SearchResultRow } from "@/lib/search";

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
  const [conds, setConds] = useState<SkillCond[]>([{ skill_id: "", min_level: 2 }]);
  const [rows, setRows] = useState<SearchResultRow[]>([]);
  const [count, setCount] = useState(0);

  const run = useCallback(() => {
    const skills = conds
      .filter((c) => c.skill_id !== "")
      .map((c) => ({ skill_id: Number(c.skill_id), min_level: c.min_level }));
    // 정적 빌드: 브라우저에서 직접 검색 (서버 API 불필요)
    const results = searchTalent({
      division: division || undefined,
      team: team || undefined,
      job_type: jobType || undefined,
      role_level: roleLevel || undefined,
      skills,
    }).sort((a, b) => b.avg_level - a.avg_level);
    setRows(results);
    setCount(results.length);
  }, [division, team, jobType, roleLevel, conds]);

  useEffect(() => {
    run();
  }, [run]);

  const sel = "border border-border-soft bg-white px-2 py-1.5 text-sm w-full";

  return (
    <div>
      <PageHeader title="Talent Search" desc="다중 조건 필터로 인재 검색 (Skill 보유 + Level + 조직)" />

      <Card title="검색 조건" className="mb-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Filter label="담당" value={division} onChange={setDivision} opts={facets.divisions} />
          <Filter label="팀" value={team} onChange={setTeam} opts={facets.teams} />
          <Filter label="직종" value={jobType} onChange={setJobType} opts={facets.jobTypes} />
          <Filter label="R/L" value={roleLevel} onChange={setRoleLevel} opts={facets.roleLevels} />
        </div>

        <div className="text-xs text-text-muted mb-2">
          보유 Skill 조건 (AND 결합 — 모두 만족하는 인원만 추출)
        </div>
        {conds.map((c, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <select
              className={sel}
              value={c.skill_id}
              onChange={(e) => {
                const next = [...conds];
                next[i].skill_id = e.target.value === "" ? "" : Number(e.target.value);
                setConds(next);
              }}
            >
              <option value="">(스킬 선택)</option>
              {facets.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  #{String(s.id).padStart(3, "0")} {s.name}
                </option>
              ))}
            </select>
            <select
              className="border border-border-soft bg-white px-2 py-1.5 text-sm w-28"
              value={c.min_level}
              onChange={(e) => {
                const next = [...conds];
                next[i].min_level = Number(e.target.value);
                setConds(next);
              }}
            >
              {[1, 2, 3, 4].map((l) => (
                <option key={l} value={l}>
                  최소 L{l}
                </option>
              ))}
            </select>
            <button
              className="border border-sk-red text-sk-red px-3 text-sm"
              onClick={() => setConds(conds.filter((_, j) => j !== i))}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          className="border border-border-soft px-3 py-1.5 text-sm text-text-muted"
          onClick={() => setConds([...conds, { skill_id: "", min_level: 2 }])}
        >
          + Skill 조건 추가
        </button>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">
          검색 결과 — <span className="text-sk-orange">{count}명</span>
        </h2>
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
                <th className="py-2 pr-3 text-right">보유 Skill</th>
                <th className="py-2 text-right">평균 Level</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee_id} className="border-b border-border-soft">
                  <td className="py-2 pr-3 font-mono text-xs">{r.employee_id}</td>
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{r.division}</td>
                  <td className="py-2 pr-3">{r.team}</td>
                  <td className="py-2 pr-3">{r.role_level}</td>
                  <td className="py-2 pr-3">{r.position}</td>
                  <td className="py-2 pr-3 text-right">{r.n_skills}</td>
                  <td className="py-2 text-right">{r.avg_level}</td>
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
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
