import type { PersonaCode } from "./types";

export const PERSONA_LABELS: Record<PersonaCode, string> = {
  hr_admin: "HR Admin",
  hr_viewer: "HR Viewer",
  team_leader: "Team Leader",
  calibration: "Calibration 참여자",
  committee: "Skill Committee 위원",
  executive: "경영진",
  employee: "구성원",
};

export interface NavItem {
  key: string;
  href: string;
  title: string;
  section: string;
  visibility: Record<PersonaCode, boolean>;
}

const T = true;
const F = false;

export const NAV_ITEMS: NavItem[] = [
  v("policy", "운영 정책 관리", "Foundation", [F, F, F, F, T, T, F]),
  v("skill-master", "Skill Library", "Foundation", [T, T, T, T, T, T, T]),
  v("member-mgmt", "구성원 Master Data", "Foundation", [F, F, F, F, T, F, F]),
  v("eval-lines", "Assessment 라인 관리", "Foundation", [T, T, T, F, T, T, F]),
  v("system-setting", "Admin 권한 관리", "Foundation", [F, F, F, F, T, F, F]),

  v("required-skill", "필요 Skill 정의", "Assessment", [T, T, T, T, T, T, T]),
  v("self-assess", "자가 진단", "Assessment", [T, T, T, T, T, F, F]),
  v("leader-assess", "리더 진단", "Assessment", [F, T, T, F, T, F, F]),
  v("calibration", "Calibration", "Assessment", [F, T, T, F, T, F, F]),
  v("narrative", "Narrative 작성", "Assessment", [F, T, T, T, T, F, F]),
  v("committee", "Committee", "Assessment", [F, F, F, T, T, F, F]),
  v("skill-profile", "최종 결과 확인", "Assessment", [T, T, T, T, T, T, F]),

  v("dashboard", "진단 결과 대시보드", "Reporting", [T, T, T, T, T, T, T]),
  v("talent-search", "Talent Search", "Reporting", [F, T, T, T, T, T, T]),
];

function v(
  key: string,
  title: string,
  section: string,
  vis: boolean[]
): NavItem {
  return {
    key,
    href: `/${key}`,
    title,
    section,
    visibility: {
      employee: vis[0],
      team_leader: vis[1],
      calibration: vis[2],
      committee: vis[3],
      hr_admin: vis[4],
      hr_viewer: vis[5],
      executive: vis[6],
    },
  };
}

export function visibleNav(persona: PersonaCode): NavItem[] {
  return NAV_ITEMS.filter((i) => i.visibility[persona]);
}

export const SECTIONS = ["Foundation", "Assessment", "Reporting"];
