"use client";

import { useMemo, useState } from "react";
import { Badge, PageHeader } from "@/components/ui";

interface MemberLite {
  employee_id: string;
  name: string;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  job_type: string | null;
}

interface SkillLite {
  skill_id: number;
  skill_name: string;
  sub_family_id: string;
  is_critical: number;
}

interface ProfileLite {
  member_id: string;
  skill_id: number;
  current_level: number;
  target_level: number;
}

interface Props {
  members: MemberLite[];
  skills: SkillLite[];
  profiles: ProfileLite[];
}

const EXAMPLES = [
  "OLED 관련 스킬을 팀별로 비교해줘",
  "Photo Resist 평균 레벨과 상위 보유자를 보여줘",
  "GC 분석 스킬이 강한 조직을 보여줘",
  "소재개발팀2의 core skill 현황을 보여줘",
];

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function inferKeywords(question: string) {
  const keywords = new Set(
    question
      .split(/[\s,./]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
  );

  if (includesAny(question, ["OLED", "Blue", "Dopant", "TADF", "블루", "도판트"])) {
    ["OLED", "Blue", "Dopant", "TADF", "유기", "분자", "소자"].forEach((word) => keywords.add(word));
  }
  if (includesAny(question, ["Photo", "Resist", "PR", "Litho", "KrF", "포토", "레지스트"])) {
    ["Photo", "Resist", "PR", "Litho", "KrF", "CTQ", "공정", "평가"].forEach((word) => keywords.add(word));
  }
  if (includesAny(question, ["GC", "LC", "HPLC", "분석"])) {
    ["GC", "LC", "HPLC", "분석", "품질", "평가"].forEach((word) => keywords.add(word));
  }
  if (includesAny(question, ["core", "코어", "핵심", "필수"])) {
    ["core", "핵심", "필수"].forEach((word) => keywords.add(word));
  }

  return [...keywords];
}

export function SkillInsightClient({ members, skills, profiles }: Props) {
  const [question, setQuestion] = useState("OLED 관련 스킬을 팀별로 비교해줘");

  const insight = useMemo(() => {
    const keywords = inferKeywords(question);
    const teamsInQuestion = [...new Set(members.map((member) => member.team).filter(Boolean))] as string[];
    const selectedTeam = teamsInQuestion.find((team) => question.includes(team));

    let matchedSkills = skills.filter((skill) =>
      keywords.some((keyword) => skill.skill_name.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (includesAny(question, ["core", "코어", "핵심", "필수"])) {
      matchedSkills = matchedSkills.filter((skill) => skill.is_critical === 1);
    }

    if (matchedSkills.length === 0) {
      matchedSkills = skills.filter((skill) => skill.is_critical === 1).slice(0, 12);
    }

    const skillIds = new Set(matchedSkills.map((skill) => skill.skill_id));
    const memberById = new Map(members.map((member) => [member.employee_id, member]));
    const skillById = new Map(skills.map((skill) => [skill.skill_id, skill]));
    const scopedProfiles = profiles.filter((profile) => skillIds.has(profile.skill_id));

    const teamStats = new Map<string, { sum: number; count: number; members: Set<string> }>();
    for (const profile of scopedProfiles) {
      const member = memberById.get(profile.member_id);
      if (!member) continue;
      if (selectedTeam && member.team !== selectedTeam) continue;
      const team = member.team ?? "미지정";
      const stat = teamStats.get(team) ?? { sum: 0, count: 0, members: new Set<string>() };
      stat.sum += profile.current_level;
      stat.count += 1;
      stat.members.add(member.employee_id);
      teamStats.set(team, stat);
    }

    const teamRows = [...teamStats.entries()]
      .map(([team, stat]) => ({
        team,
        avg: stat.count ? Math.round((stat.sum / stat.count) * 100) / 100 : 0,
        count: stat.count,
        members: stat.members.size,
      }))
      .sort((a, b) => b.avg - a.avg);

    const memberStats = new Map<string, { sum: number; count: number; matched: string[] }>();
    for (const profile of scopedProfiles) {
      const member = memberById.get(profile.member_id);
      if (!member) continue;
      if (selectedTeam && member.team !== selectedTeam) continue;
      const stat = memberStats.get(profile.member_id) ?? { sum: 0, count: 0, matched: [] };
      stat.sum += profile.current_level;
      stat.count += 1;
      const skillName = skillById.get(profile.skill_id)?.skill_name;
      if (skillName && profile.current_level > 0) stat.matched.push(`${skillName} L${profile.current_level}`);
      memberStats.set(profile.member_id, stat);
    }

    const topMembers = [...memberStats.entries()]
      .map(([memberId, stat]) => {
        const member = memberById.get(memberId)!;
        return {
          ...member,
          avg: stat.count ? Math.round((stat.sum / stat.count) * 100) / 100 : 0,
          count: stat.count,
          matched: stat.matched.slice(0, 4),
        };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 8);

    const totalProfiles = scopedProfiles.length;
    const avgLevel =
      totalProfiles > 0
        ? Math.round((scopedProfiles.reduce((sum, profile) => sum + profile.current_level, 0) / totalProfiles) * 100) / 100
        : 0;

    return {
      keywords,
      selectedTeam,
      matchedSkills,
      teamRows,
      topMembers,
      avgLevel,
      totalProfiles,
    };
  }, [members, profiles, question, skills]);

  const maxTeamAvg = Math.max(...insight.teamRows.map((row) => row.avg), 1);

  return (
    <div>
      <PageHeader
        title="Skill Insight"
        desc="자연어 질문을 기반으로 내부 Skill Profile을 집계해 조직별 평균, 상위 보유자, 관련 Skill 범위를 보여줍니다."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <section className="border border-border-soft bg-white">
          <div className="border-b border-border-soft bg-bg-main/60 px-4 py-3">
            <div className="font-extrabold text-text-main">자연어 분석 조건</div>
            <div className="mt-1 text-xs text-text-muted">
              예: OLED, Photo Resist, GC 분석, 특정 팀, core skill 같은 키워드를 입력하세요.
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-28 w-full resize-none border border-border-soft bg-white p-3 text-sm outline-none focus:border-sk-orange"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setQuestion(example)}
                  className="border border-border-soft bg-bg-main px-3 py-1.5 text-xs text-text-muted hover:border-sk-orange hover:text-[#C45E00]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Metric label="매칭 Skill" value={`${insight.matchedSkills.length}개`} note={insight.selectedTeam ?? "전체 조직"} />
          <Metric label="평균 Skill Level" value={`L${insight.avgLevel}`} note="매칭 Skill Profile 기준" />
          <Metric label="집계 Profile" value={`${insight.totalProfiles}건`} note="평가 완료 더미 포함" />
          <Metric label="상위 보유자" value={`${insight.topMembers.length}명`} note="평균 Level 기준" />
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <Panel title="팀별 평균 Skill Level">
          {insight.teamRows.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {insight.teamRows.map((row) => (
                <div key={row.team}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-text-main">{row.team}</span>
                    <span className="text-text-muted">
                      L{row.avg} · {row.members}명 · {row.count}건
                    </span>
                  </div>
                  <div className="h-3 bg-bg-main">
                    <div
                      className="h-3 bg-sk-orange"
                      style={{ width: `${Math.max(6, (row.avg / maxTeamAvg) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="평균 Skill Level 기준 상위 보유자">
          {insight.topMembers.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border-soft text-left text-text-muted">
                    <th className="py-2 pr-3">이름</th>
                    <th className="py-2 pr-3">조직</th>
                    <th className="py-2 pr-3">R/L</th>
                    <th className="py-2 pr-3 text-right">평균</th>
                    <th className="py-2">대표 Skill</th>
                  </tr>
                </thead>
                <tbody>
                  {insight.topMembers.map((member) => (
                    <tr key={member.employee_id} className="border-b border-border-soft align-top">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-text-main">{member.name}</div>
                        <div className="font-mono text-xs text-text-muted">{member.employee_id}</div>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {member.division ?? "-"} / {member.team ?? "-"}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {member.role_level ?? "-"} / {member.position ?? "-"}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold text-text-main">L{member.avg}</td>
                      <td className="py-2 text-text-muted">{member.matched.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,1fr]">
        <Panel title="매칭된 Skill">
          <div className="flex flex-wrap gap-2">
            {insight.matchedSkills.slice(0, 40).map((skill) => (
              <Badge
                key={skill.skill_id}
                tone={skill.is_critical ? "orange" : "neutral"}
                label={skill.skill_name}
              />
            ))}
          </div>
        </Panel>
        <Panel title="해석 요약">
          <div className="space-y-2 text-sm text-text-muted">
            <p>
              입력 문장에서 추출한 키워드:{" "}
              <span className="font-semibold text-text-main">{insight.keywords.slice(0, 12).join(", ") || "-"}</span>
            </p>
            <p>
              이 화면은 고정 Dashboard를 대체하지 않고, 자연어로 분석 범위를 빠르게 좁혀보는 별도 Insight 화면입니다.
            </p>
            <p>
              후보자 추천은 우측 하단 챗봇과 Talent Search에서 분리해서 다룹니다.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-border-soft bg-white p-4">
      <div className="text-xs font-semibold text-text-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-text-main">{value}</div>
      <div className="mt-1 text-xs text-text-muted">{note}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-soft bg-white">
      <div className="border-b border-border-soft bg-bg-main/60 px-4 py-2.5 text-[13px] font-extrabold text-text-main">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty() {
  return <div className="text-sm text-text-muted">조건에 맞는 데이터가 없습니다.</div>;
}
