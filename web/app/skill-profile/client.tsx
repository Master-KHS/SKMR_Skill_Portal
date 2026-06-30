"use client";
import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Badge, Stat } from "@/components/ui";

interface Row {
  skill_id: number;
  skill_name: string;
  sub_family_name: string;
  family_name: string;
  current_level: number;
  target_level: number | null;
  is_critical: number;
}

export function SkillProfileClient({ members }: { members: { id: string; label: string }[] }) {
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!memberId) return;
    const res = await fetch(`/api/self-assess?member_id=${memberId}`);
    const data = await res.json();
    setRows(data.rows ?? []);
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const avg = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.current_level, 0) / rows.length) * 100) / 100
    : 0;
  const metCount = rows.filter((r) => r.target_level && r.current_level >= r.target_level).length;
  const gapCount = rows.filter((r) => r.target_level && r.current_level < r.target_level).length;

  return (
    <div className="max-w-5xl">
      <PageHeader title="최종 결과 확인" desc="구성원별 확정 Skill 보유 현황" />

      <Card className="mb-4">
        <label className="text-sm text-text-muted mr-3">구성원</label>
        <select
          className="border border-border-soft bg-white px-3 py-1.5 text-sm"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Card>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Stat label="보유 Skill" value={`${rows.length}개`} accent />
        <Stat label="평균 Level" value={avg} />
        <Stat label="목표 달성" value={`${metCount}개`} />
        <Stat label="Gap" value={`${gapCount}개`} />
      </div>

      <Card title="Skill 상세">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="py-2 pr-3">Family / Sub</th>
              <th className="py-2 pr-3">Skill</th>
              <th className="py-2 pr-3 w-20">현재</th>
              <th className="py-2 pr-3 w-20">목표</th>
              <th className="py-2 w-24">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const gap = r.target_level ? r.current_level - r.target_level : null;
              return (
                <tr key={r.skill_id} className="border-b border-border-soft">
                  <td className="py-2 pr-3 text-xs text-text-muted">
                    {r.family_name} / {r.sub_family_name}
                  </td>
                  <td className="py-2 pr-3">
                    {r.skill_name}
                    {r.is_critical ? (
                      <span className="ml-2"><Badge tone="danger" label="Critical" /></span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-bold">L{r.current_level}</td>
                  <td className="py-2 pr-3 text-text-muted">{r.target_level ? `L${r.target_level}` : "-"}</td>
                  <td className="py-2">
                    {gap === null ? (
                      "-"
                    ) : gap >= 0 ? (
                      <Badge tone="success" label="달성" />
                    ) : (
                      <Badge tone="warning" label={`부족 ${gap}`} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
