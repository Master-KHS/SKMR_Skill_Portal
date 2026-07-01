import { evaluableMemberOptions } from "@/lib/member-options";
import { NarrativeClient } from "./client";

export const dynamic = "force-dynamic";

export default function NarrativePage() {
  return <NarrativeClient members={evaluableMemberOptions()} />;
}
