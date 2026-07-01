import "server-only";
import type { AssistantDataSlot } from "./assistant-types";

export function getAssistantDataSlots(): AssistantDataSlot[] {
  return [
    {
      key: "members_xlsx",
      label: "members.xlsx",
      status: "ready",
      note: "구성원 마스터와 페르소나 매핑은 현재 검색에 반영됩니다.",
    },
    {
      key: "skill_profile_db",
      label: "skill_profile",
      status: "ready",
      note: "보유 스킬, 현재 레벨, 평균 레벨은 현재 검색과 추천에 반영됩니다.",
    },
    {
      key: "appointments_raw",
      label: "발령이력 로데이터",
      status: "pending_definition",
      note: "컬럼 구조가 정의되면 이동 이력과 유사 경험 기반 추천 근거를 추가할 수 있습니다.",
    },
    {
      key: "assessment_history_raw",
      label: "평가이력 로데이터",
      status: "pending_definition",
      note: "컬럼 구조가 정의되면 최근 평가 추세와 단계별 이력 근거를 추가할 수 있습니다.",
    },
    {
      key: "member_docs_raw",
      label: "직무기술/경력 문서",
      status: "pending_definition",
      note: "문서 포맷이 정해지면 검색 결과별 RAG 근거를 더 정확하게 붙일 수 있습니다.",
    },
  ];
}
