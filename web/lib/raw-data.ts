import "server-only";
import type { AssistantDataSlot } from "./assistant-types";

export function getAssistantDataSlots(): AssistantDataSlot[] {
  return [
    {
      key: "members_xlsx",
      label: "members.xlsx",
      status: "ready",
      note: "구성원 마스터, 조직, R/L, 직책, 직종, 페르소나를 인재검색 기준으로 사용합니다.",
    },
    {
      key: "education_job_profile",
      label: "education_job_profile.xlsx",
      status: "ready",
      note: "직무, 최종학력, 학교명, 전공을 후보 적합성 판단 근거로 사용합니다.",
    },
    {
      key: "pi_tasks_3y",
      label: "pi_tasks_3y.xlsx",
      status: "ready",
      note: "최근 3개년 KPI 과제를 기술 키워드와 가장 직접적으로 연결하는 경험 근거로 사용합니다.",
    },
    {
      key: "performance_reviews_3y",
      label: "performance_reviews_3y.xlsx",
      status: "ready",
      note: "최근 3개년 평가 결과를 성과 안정성 근거로 사용합니다.",
    },
    {
      key: "appointments",
      label: "appointments.xlsx",
      status: "ready",
      note: "채용, 승진, 이동 등 발령 이력을 후보자의 경력 흐름 근거로 사용합니다.",
    },
    {
      key: "skill_profile_db",
      label: "SQLite skill_profile / assessment",
      status: "ready",
      note: "보유 Skill, 현재 Level, 목표 Level, 진단 단계별 확정 결과를 추천 근거로 사용합니다.",
    },
    {
      key: "external_academic",
      label: "Gemini + 외부 학술/연구실 검색",
      status: "pending_definition",
      note: "Gemini API 연결 후 논문, Google Scholar, 연구실/공개 자료 확인 메시지와 보강 근거를 제공합니다.",
    },
  ];
}
