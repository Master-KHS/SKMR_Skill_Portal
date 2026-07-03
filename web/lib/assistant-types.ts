export interface SkillCondition {
  skill_id: number;
  min_level: number;
}

export interface SearchFilters {
  member_name?: string;
  division?: string;
  team?: string;
  job_type?: string;
  role_level?: string;
  role_level_min?: string;
  role_level_max?: string;
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

export interface AssistantDashboardMetric {
  label: string;
  value: string;
  note?: string;
}

export interface AssistantDashboardBar {
  label: string;
  value: number;
  displayValue: string;
}

export interface AssistantDashboardInsight {
  title: string;
  detail: string;
}

export interface AssistantDashboard {
  title: string;
  subtitle: string;
  metrics: AssistantDashboardMetric[];
  teamAverages: AssistantDashboardBar[];
  topMembers: AssistantDashboardBar[];
  insights: AssistantDashboardInsight[];
}

export interface AssistantMemberAcademic {
  title: string;
  note: string;
  items: { label: string; value: string }[];
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
  dashboard?: AssistantDashboard;
  memberAcademic?: AssistantMemberAcademic;
}
