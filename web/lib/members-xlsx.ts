// 구성원 Master Data: data/members.xlsx 를 Single Source of Truth로 취급하는 파일 I/O 모듈.
import "server-only";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { Member } from "./types";

export const MEMBERS_XLSX_PATH = path.join(process.cwd(), "data", "members.xlsx");

export const XLS_COLS: [keyof Member, string][] = [
  ["employee_id", "사번"],
  ["name", "이름"],
  ["corporation", "법인"],
  ["division", "담당"],
  ["team", "팀"],
  ["role_level", "R/L"],
  ["role_tenure", "R/L 연차"],
  ["position", "직책"],
  ["job_type", "직종"],
  ["persona_role", "페르소나"],
];

export function membersXlsxExists(): boolean {
  return fs.existsSync(MEMBERS_XLSX_PATH);
}

function normalizeValue(field: keyof Member, value: unknown): string | number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (field === "role_tenure") {
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }
  return text;
}

export function readMembersFromXlsx(): Member[] {
  if (!membersXlsxExists()) return [];
  const buf = fs.readFileSync(MEMBERS_XLSX_PATH);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const label2field = new Map(XLS_COLS.map(([field, label]) => [label, field]));

  const out: Member[] = [];
  for (const row of json) {
    const m: Partial<Member> = { extra_attrs: null };
    for (const [key, value] of Object.entries(row)) {
      const field = label2field.get(String(key).trim());
      if (field) (m as Record<string, unknown>)[field] = normalizeValue(field, value);
    }
    if (m.employee_id && m.name) out.push(m as Member);
  }
  return out;
}

export function writeMembersToXlsx(members: Member[]): void {
  const aoa = [
    XLS_COLS.map(([, label]) => label),
    ...members.map((m) => XLS_COLS.map(([field]) => m[field] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "members");
  fs.mkdirSync(path.dirname(MEMBERS_XLSX_PATH), { recursive: true });
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(MEMBERS_XLSX_PATH, buf);
}
