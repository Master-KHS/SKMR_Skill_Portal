import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MemberRow {
  employee_id: string;
  name: string;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
}

interface RequiredRow {
  org_or_individual: string;
  target_id: string;
  skill_id: number;
  target_level: number;
  is_core: number;
  skill_name: string;
  family_name: string;
  sub_family_name: string;
}

interface ProfileRow {
  member_id: string;
  skill_id: number;
  current_level: number;
}

export async function GET() {
  const members = query<MemberRow>(
    `SELECT employee_id, name, division, team, role_level, position
       FROM member
      WHERE job_type IN ('사무직','기술직','연구직')
      ORDER BY division, team, role_level DESC, name`
  );
  const required = query<RequiredRow>(
    `SELECT r.org_or_individual, r.target_id, r.skill_id, r.target_level, r.is_core,
            s.skill_name, f.family_name, sf.sub_family_name
       FROM required_skill r
       JOIN skill s ON r.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
      WHERE r.status = 'approved'
        AND r.is_core = 1
        AND r.org_or_individual IN ('company','department')
      ORDER BY r.org_or_individual, r.target_id, r.skill_id`
  );
  const profiles = query<ProfileRow>(`SELECT member_id, skill_id, current_level FROM skill_profile`);
  const profileMap = new Map(profiles.map((row) => [`${row.member_id}:${row.skill_id}`, row.current_level]));

  const rows = members.flatMap((member) => {
    const bySkill = new Map<number, RequiredRow & { sources: string[] }>();
    for (const req of required) {
      const applies =
        (req.org_or_individual === "company" && req.target_id === "ALL") ||
        (req.org_or_individual === "department" && req.target_id === member.team);
      if (!applies) continue;

      const source = req.org_or_individual === "company" ? "전사" : "팀";
      const prev = bySkill.get(req.skill_id);
      if (!prev || req.target_level > prev.target_level) {
        bySkill.set(req.skill_id, { ...req, sources: prev ? [...prev.sources, source] : [source] });
      } else {
        prev.sources.push(source);
      }
    }

    return [...bySkill.values()].map((req) => {
      const current = profileMap.get(`${member.employee_id}:${req.skill_id}`) ?? 0;
      return {
        사번: member.employee_id,
        이름: member.name,
        담당: member.division ?? "",
        팀: member.team ?? "",
        "R/L": member.role_level ?? "",
        직책: member.position ?? "",
        출처: [...new Set(req.sources)].join("+"),
        "Skill ID": req.skill_id,
        "Skill 명": req.skill_name,
        Family: req.family_name,
        "Sub-family": req.sub_family_name,
        "요구 Level": req.target_level,
        "현재 Level": current,
        Gap: Math.max(req.target_level - current, 0),
      };
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "core-skill-levels");
  const body = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=core-skill-levels.xlsx",
    },
  });
}
