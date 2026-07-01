import "server-only";
import { getMembers } from "./data";

// 평가 대상(사무/기술/연구직) 구성원 셀렉트 옵션.
export function evaluableMemberOptions() {
  return getMembers()
    .filter((m) => ["사무직", "기술직", "연구직"].includes(m.job_type ?? ""))
    .map((m) => ({ id: m.employee_id, label: `${m.name} (${m.team ?? "-"} · ${m.role_level ?? "-"})` }));
}
