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

function toPlain<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...(row as object) } as T));
}

export function getMembers(): Member[] {
  return toPlain(query<Member>("SELECT * FROM member ORDER BY employee_id"));
}

export function getSkills(): Skill[] {
  return toPlain(query<Skill>("SELECT * FROM skill ORDER BY skill_id"));
}

export function getSkillProfiles(): SkillProfile[] {
  return toPlain(query<SkillProfile>("SELECT * FROM skill_profile"));
}

export function getSubFamilies(): SubSkillFamily[] {
  return toPlain(query<SubSkillFamily>("SELECT * FROM sub_skill_family"));
}

export function getFamilies(): SkillFamily[] {
  return toPlain(query<SkillFamily>("SELECT * FROM skill_family"));
}

export function getLevelCriteria(): LevelCriteria[] {
  return toPlain(query<LevelCriteria>("SELECT * FROM level_criteria"));
}

export function getRequiredSkills(): RequiredSkill[] {
  return toPlain(query<RequiredSkill>("SELECT * FROM required_skill"));
}
