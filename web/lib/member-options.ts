import "server-only";
import { getMembers } from "./data";

export interface MemberOption {
  id: string;
  label: string;
  team: string | null;
  division: string | null;
}

// 평가 대상(사무/기술/연구직) 구성원 셀렉트 옵션. team/division 포함 — 페르소나별 범위 제한에 사용.
export function evaluableMemberOptions(): MemberOption[] {
  return getMembers()
    .filter((m) => ["사무직", "기술직", "연구직"].includes(m.job_type ?? ""))
    .map((m) => ({
      id: m.employee_id,
      label: `${m.name} (${m.team ?? "-"} · ${m.role_level ?? "-"})`,
      team: m.team,
      division: m.division,
    }));
}
