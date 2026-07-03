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

let membersCache: Member[] | null = null;
let skillsCache: Skill[] | null = null;
let skillProfilesCache: SkillProfile[] | null = null;
let subFamiliesCache: SubSkillFamily[] | null = null;
let familiesCache: SkillFamily[] | null = null;
let levelCriteriaCache: LevelCriteria[] | null = null;
let requiredSkillsCache: RequiredSkill[] | null = null;

export function getMembers(): Member[] {
  if (!membersCache) membersCache = toPlain(query<Member>("SELECT * FROM member ORDER BY employee_id"));
  return membersCache;
}

export function getSkills(): Skill[] {
  if (!skillsCache) skillsCache = toPlain(query<Skill>("SELECT * FROM skill ORDER BY skill_id"));
  return skillsCache;
}

export function getSkillProfiles(): SkillProfile[] {
  if (!skillProfilesCache) skillProfilesCache = toPlain(query<SkillProfile>("SELECT * FROM skill_profile"));
  return skillProfilesCache;
}

export function getSubFamilies(): SubSkillFamily[] {
  if (!subFamiliesCache) subFamiliesCache = toPlain(query<SubSkillFamily>("SELECT * FROM sub_skill_family"));
  return subFamiliesCache;
}

export function getFamilies(): SkillFamily[] {
  if (!familiesCache) familiesCache = toPlain(query<SkillFamily>("SELECT * FROM skill_family"));
  return familiesCache;
}

export function getLevelCriteria(): LevelCriteria[] {
  if (!levelCriteriaCache) levelCriteriaCache = toPlain(query<LevelCriteria>("SELECT * FROM level_criteria"));
  return levelCriteriaCache;
}

export function getRequiredSkills(): RequiredSkill[] {
  if (!requiredSkillsCache) requiredSkillsCache = toPlain(query<RequiredSkill>("SELECT * FROM required_skill"));
  return requiredSkillsCache;
}
