// 구성원 Master Data — data/members.xlsx 를 Single Source of Truth로 취급하는 순수 파일 I/O 모듈.
// DB에 의존하지 않음 (lib/db.ts 가 이 모듈을 가져다 씀, 역방향 의존 없음).
import "server-only";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { Member } from "./types";

export const MEMBERS_XLSX_PATH = path.join(process.cwd(), "data", "members.xlsx");

// 엑셀 헤더(한글) ↔ Member 필드 매핑. 순서가 곧 엑셀 컬럼 순서.
export const XLS_COLS: [keyof Member, string][] = [
  ["employee_id", "사번"], ["name", "이름"], ["corporation", "법인"], ["division", "담당"],
  ["team", "팀"], ["role_level", "R/L"], ["position", "직책"], ["job_type", "직종"], ["persona_role", "페르소나"],
];

export function membersXlsxExists(): boolean {
  return fs.existsSync(MEMBERS_XLSX_PATH);
}

// data/members.xlsx 를 읽어 Member[] 로 반환. 파일이 없으면 빈 배열.
// 정제된 원본으로 취급 — 사번 중복/보정 등을 임의로 고치지 않고 있는 그대로 읽음.
export function readMembersFromXlsx(): Member[] {
  if (!membersXlsxExists()) return [];
  // XLSX.readFile()은 Next.js standalone 번들에서 내부 fs 감지가 깨져 "Cannot access file" 오류가 남.
  // fs로 직접 읽어 버퍼를 넘기는 방식이 번들 환경에 안전함.
  const buf = fs.readFileSync(MEMBERS_XLSX_PATH);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const label2field = new Map(XLS_COLS.map(([f, l]) => [l, f]));

  const out: Member[] = [];
  for (const row of json) {
    const m: Partial<Member> = { extra_attrs: null };
    for (const [k, v] of Object.entries(row)) {
      const field = label2field.get(String(k).trim());
      if (field) (m as Record<string, unknown>)[field] = String(v).trim() || null;
    }
    if (m.employee_id && m.name) out.push(m as Member);
  }
  return out;
}

// Member[] 를 data/members.xlsx 로 저장 (덮어쓰기). xlsx 바이너리 포맷이라 한글 인코딩 깨짐 없음(BOM/코드페이지 무관).
export function writeMembersToXlsx(members: Member[]): void {
  const aoa = [
    XLS_COLS.map(([, label]) => label),
    ...members.map((m) => XLS_COLS.map(([field]) => (m[field] ?? "") as string)),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "members");
  fs.mkdirSync(path.dirname(MEMBERS_XLSX_PATH), { recursive: true });
  // XLSX.writeFile() 도 같은 이유(번들 환경 fs 감지)로 버퍼를 만들어 fs로 직접 씀.
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(MEMBERS_XLSX_PATH, buf);
}
