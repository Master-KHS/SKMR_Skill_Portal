import "server-only";
import { getMembers } from "./data";
import { getRawDataSummary } from "./assistant-raw-data";
import type { AssistantExternalCandidateResult, AssistantExternalLink, AssistantExternalSearchResponse } from "./assistant-types";

const READY_NAMES = new Set(["임가영", "김선재"]);
const POLICY_NOTE =
  "사용자 승인은 확인했지만 현재 실행 환경 정책상 Codex가 실명/학교명을 외부 서비스로 자동 전송해 수집할 수 없습니다. 직접 조회 링크 기반으로만 안내합니다.";

function normalizeQuery(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function buildSearchQueries(name: string, school?: string | null, major?: string | null) {
  return [
    normalizeQuery([name, school, major, "Google Scholar"]),
    normalizeQuery([name, major, "논문"]),
    normalizeQuery([name, school, "연구실"]),
    normalizeQuery([name, school, major, "site:ac.kr"]),
  ];
}

function link(label: string, query: string): AssistantExternalLink {
  return {
    label,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  };
}

function buildLinks(name: string, school?: string | null, major?: string | null): AssistantExternalLink[] {
  const scholarQuery = normalizeQuery([name, school, major, "Google Scholar"]);
  const paperQuery = normalizeQuery([name, major, "논문"]);
  const labQuery = normalizeQuery([name, school, "연구실"]);
  const officialQuery = normalizeQuery([name, school, major, "site:ac.kr"]);

  return [
    link("Google Scholar 검색", scholarQuery),
    link("논문 검색", paperQuery),
    link("연구실 검색", labQuery),
    link("학교/공식 페이지 검색", officialQuery),
  ];
}

function buildResult(employeeId: string): AssistantExternalCandidateResult {
  const member = getMembers().find((item) => item.employee_id === employeeId);
  const raw = getRawDataSummary(employeeId);
  const name = member?.name ?? employeeId;
  const school = raw.education?.school || "";
  const major = raw.education?.major || "";
  const queries = buildSearchQueries(name, school, major);
  const links = buildLinks(name, school, major);

  if (!member) {
    return {
      employee_id: employeeId,
      name,
      status: "error",
      note: "구성원 마스터에서 대상자를 찾지 못했습니다.",
      searchQueries: queries,
      papers: [],
      labs: [],
    };
  }

  if (!READY_NAMES.has(name)) {
    return {
      employee_id: employeeId,
      name,
      status: "needs_identity_match",
      note: "내부 학력 정보는 있으나 외부 공개 정보와의 실명/학교명 정합성 검토가 먼저 필요합니다.",
      searchQueries: queries,
      papers: [],
      labs: [],
      links,
    };
  }

  return {
    employee_id: employeeId,
    name,
    status: "policy_blocked",
    note: POLICY_NOTE,
    searchQueries: queries,
    papers: [],
    labs: [],
    links,
  };
}

export async function runAssistantExternalSearch(candidateIds: string[]): Promise<AssistantExternalSearchResponse> {
  const results = candidateIds.map((employeeId) => buildResult(employeeId));
  const hasError = results.some((item) => item.status === "error");
  const hasPartial = results.some((item) => item.status !== "success");

  return {
    status: hasError ? "error" : hasPartial ? "partial" : "success",
    searchedAt: new Date().toISOString(),
    scope: ["논문 메타데이터", "Google Scholar", "연구실/랩 이력", "공개 프로필"],
    note: POLICY_NOTE,
    results,
  };
}
