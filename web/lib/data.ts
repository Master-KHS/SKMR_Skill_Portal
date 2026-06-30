// 시드 데이터 단일 접근점. 현재는 정적 JSON(web/data/seed.json)을 읽음.
// 추후 실제 DB/API로 교체할 때 이 파일만 바꾸면 됨.
import seed from "@/data/seed.json";
import type {
  SeedData,
  Member,
  Skill,
  SkillProfile,
  SubSkillFamily,
  SkillFamily,
} from "./types";

const data = seed as unknown as SeedData;

export function getSeed(): SeedData {
  return data;
}

export function getMembers(): Member[] {
  return data.member;
}

export function getSkills(): Skill[] {
  return data.skill;
}

export function getSkillProfiles(): SkillProfile[] {
  return data.skill_profile;
}

export function getSubFamilies(): SubSkillFamily[] {
  return data.sub_skill_family;
}

export function getFamilies(): SkillFamily[] {
  return data.skill_family;
}

// 자주 쓰는 조회용 인덱스
export function skillById(): Map<number, Skill> {
  return new Map(data.skill.map((s) => [s.skill_id, s]));
}

export function memberById(): Map<string, Member> {
  return new Map(data.member.map((m) => [m.employee_id, m]));
}

// 스킬 이름 → skill_id (부분 일치). 챗봇이 자연어 스킬명을 식별할 때 사용.
export function findSkillsByName(query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return data.skill.filter((s) => s.skill_name.toLowerCase().includes(q));
}
