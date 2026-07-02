import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SkillHoldingRow {
  employee_id: string;
  name: string;
  corporation: string | null;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  job_type: string | null;
  skill_id: number;
  skill_name: string;
  family_name: string;
  sub_family_name: string;
  is_critical: number;
  current_level: number;
  target_level: number;
  last_assessed_date: string | null;
}

export async function GET() {
  const rows = query<SkillHoldingRow>(
    `SELECT m.employee_id, m.name, m.corporation, m.division, m.team,
            m.role_level, m.position, m.job_type,
            s.skill_id, s.skill_name, f.family_name, sf.sub_family_name, s.is_critical,
            sp.current_level, sp.target_level, sp.last_assessed_date
       FROM skill_profile sp
       JOIN member m ON sp.member_id = m.employee_id
       JOIN skill s ON sp.skill_id = s.skill_id
       JOIN sub_skill_family sf ON s.sub_family_id = sf.sub_family_id
       JOIN skill_family f ON sf.family_id = f.family_id
      WHERE m.job_type IN ('사무직','기술직','연구직')
      ORDER BY m.division, m.team, m.role_level DESC, m.name, s.skill_id`
  ).map((row) => ({
    사번: row.employee_id,
    이름: row.name,
    법인: row.corporation ?? "",
    담당: row.division ?? "",
    팀: row.team ?? "",
    "R/L": row.role_level ?? "",
    직책: row.position ?? "",
    직종: row.job_type ?? "",
    "Skill ID": row.skill_id,
    "Skill 명": row.skill_name,
    Family: row.family_name,
    "Sub-family": row.sub_family_name,
    Critical: row.is_critical ? "Y" : "N",
    "현재 Level": row.current_level,
    "목표 Level": row.target_level,
    Gap: Math.max((row.target_level ?? 0) - (row.current_level ?? 0), 0),
    "최근 평가일": row.last_assessed_date ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "skill-profile");
  const body = new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=skill-profile-holdings.xlsx",
    },
  });
}
