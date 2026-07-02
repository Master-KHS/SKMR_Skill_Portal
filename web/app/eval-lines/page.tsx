import { getMembers } from "@/lib/data";
import { EvalLinesClient } from "./client";

export const dynamic = "force-dynamic";

export default function EvalLinesPage() {
  return <EvalLinesClient members={getMembers()} />;
}
