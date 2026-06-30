// 데이터 접근점 (서버 전용) — SQLite DB에서 읽음.
// 클라이언트 컴포넌트에서 import 금지(네이티브 모듈). API 라우트/서버 컴포넌트에서만 사용.
import "server-only";
import { query } from "./db";
import type {
  Member,
  Skill,
  SkillProfile,
  SubSkillFamily,
  SkillFamily,
  LevelCriteria,
  RequiredSkill,
} from "./types";

export function getMembers(): Member[] {
  return query<Member>("SELECT * FROM member ORDER BY employee_id");
}

export function getSkills(): Skill[] {
  return query<Skill>("SELECT * FROM skill ORDER BY skill_id");
}

export function getSkillProfiles(): SkillProfile[] {
  return query<SkillProfile>("SELECT * FROM skill_profile");
}

export function getSubFamilies(): SubSkillFamily[] {
  return query<SubSkillFamily>("SELECT * FROM sub_skill_family");
}

export function getFamilies(): SkillFamily[] {
  return query<SkillFamily>("SELECT * FROM skill_family");
}

export function getLevelCriteria(): LevelCriteria[] {
  return query<LevelCriteria>("SELECT * FROM level_criteria");
}

export function getRequiredSkills(): RequiredSkill[] {
  return query<RequiredSkill>("SELECT * FROM required_skill");
}
