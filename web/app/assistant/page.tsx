import { getSkills, getMembers } from "@/lib/data";
import { AssistantClient } from "./client";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const skills = getSkills().map((s) => ({ skill_id: s.skill_id, skill_name: s.skill_name }));
  const members = getMembers();
  const divisions = [...new Set(members.map((m) => m.division).filter(Boolean))] as string[];
  const teams = [...new Set(members.map((m) => m.team).filter(Boolean))] as string[];
  // 키는 런타임 env(GEMINI_API_KEY, 배치파일이 설정)에서 읽어 클라이언트로 전달.
  // → 브라우저가 직접 Gemini 호출(로컬/회사망 인터넷 사용). 서버 아웃바운드 불필요.
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  return (
    <AssistantClient
      meta={{ skills, divisions, teams }}
      apiKey={apiKey}
      model={model}
    />
  );
}
