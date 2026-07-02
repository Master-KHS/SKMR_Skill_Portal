import { evaluableMemberOptions } from "@/lib/member-options";
import { PersonalReportClient } from "./client";

export const dynamic = "force-dynamic";

export default function PersonalReportPage() {
  return <PersonalReportClient members={evaluableMemberOptions()} />;
}
