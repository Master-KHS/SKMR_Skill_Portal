// 기존 SQLite 스키마(app/schema.py)를 TypeScript 타입으로 옮긴 것.
export interface Member {
  employee_id: string;
  name: string;
  corporation: string | null;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  job_type: string | null;
  persona_role: string | null;
  extra_attrs: string | null;
}

export interface SkillFamily {
  family_id: string;
  family_name: string;
  description: string | null;
}

export interface SubSkillFamily {
  sub_family_id: string;
  family_id: string;
  sub_family_name: string;
  description: string | null;
}

export interface Skill {
  skill_id: number;
  sub_family_id: string;
  skill_name: string;
  description: string | null;
  is_critical: number;
}

export interface LevelCriteria {
  sub_family_id: string;
  level: number;
  expertise_criteria: string;
  impact_criteria: string;
}

export interface RequiredSkill {
  org_or_individual: string;
  target_id: string;
  skill_id: number;
  target_level: number;
  is_core: number;
  status: string;
}

export interface SkillProfile {
  member_id: string;
  skill_id: number;
  current_level: number;
  target_level: number;
  last_assessed_date: string | null;
}

export interface Evidence {
  evidence_id: number;
  member_id: string;
  evidence_type: string;
  title: string;
  description: string | null;
  file_path: string | null;
  created_date: string | null;
}

export interface EvidenceSkillLink {
  evidence_id: number;
  skill_id: number;
}

export interface SeedData {
  skill_family: SkillFamily[];
  sub_skill_family: SubSkillFamily[];
  skill: Skill[];
  level_criteria: LevelCriteria[];
  member: Member[];
  required_skill: RequiredSkill[];
  skill_profile: SkillProfile[];
  evidence: Evidence[];
  evidence_skill_link: EvidenceSkillLink[];
}

export type PersonaCode =
  | "employee"
  | "team_leader"
  | "calibration"
  | "committee"
  | "hr_admin"
  | "hr_viewer"
  | "executive";
