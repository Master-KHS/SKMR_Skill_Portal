import { getMembers } from "@/lib/data";
import { SelfAssessClient } from "./client";

export const dynamic = "force-dynamic";

export default function SelfAssessPage() {
  const members = getMembers()
    .filter((m) => ["사무직", "기술직", "연구직"].includes(m.job_type ?? ""))
    .map((m) => ({
      id: m.employee_id,
      label: `${m.name} (${m.team ?? "-"} · ${m.role_level ?? "-"})`,
    }));
  return <SelfAssessClient members={members} />;
}
