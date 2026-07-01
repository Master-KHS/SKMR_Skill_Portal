export interface SkillCondition {
  skill_id: number;
  min_level: number;
}

export interface SearchFilters {
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  position?: string;
  skills?: SkillCondition[];
}

export interface SearchResultRow {
  employee_id: string;
  name: string;
  division: string | null;
  team: string | null;
  role_level: string | null;
  position: string | null;
  job_type: string | null;
  n_skills: number;
  avg_level: number;
  matched: { skill_id: number; skill_name: string; level: number }[];
}

export interface AssistantDocEvidence {
  file: string;
  loc: string;
  text: string;
}

export interface AssistantDataSlot {
  key: string;
  label: string;
  status: "ready" | "pending_definition";
  note: string;
}

export interface AssistantResponse {
  answer: string;
  filters: SearchFilters;
  interpretedIntent: string | null;
  unresolvedSkills: string[];
  results: SearchResultRow[];
  totalCount: number;
  sources: { employee_id: string; name: string; team: string | null }[];
  verification: "pass" | "fail" | "review";
  grounded: boolean;
  docEvidence: AssistantDocEvidence[];
  dataSlots: AssistantDataSlot[];
  followUpSuggestions: string[];
}
