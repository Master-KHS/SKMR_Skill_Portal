import "server-only";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

export interface EducationJobProfile {
  employee_id: string;
  name: string;
  job: string;
  education: string;
  school: string;
  major: string;
}

export interface PiTaskProfile {
  employee_id: string;
  name: string;
  year: number;
  task: string;
  plan: string;
  target: string;
  weight: number;
  selfRating: string;
}

export interface ReviewProfile {
  employee_id: string;
  name: string;
  year: number;
  rating: string;
  system: string;
  org: string;
}

export interface AppointmentProfile {
  employee_id: string;
  name: string;
  date: string;
  type: string;
  reason: string;
  afterOrg: string;
  afterRoleLevel: string;
  afterPosition: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

function readRows(fileName: string): Record<string, unknown>[] {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

function text(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function num(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function getEducationJobProfiles(): EducationJobProfile[] {
  return readRows("education_job_profile.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    job: text(row, "직무"),
    education: text(row, "최종학력"),
    school: text(row, "학교명"),
    major: text(row, "전공"),
  }));
}

export function getPiTasks(): PiTaskProfile[] {
  return readRows("pi_tasks_3y.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    year: num(row, "평가연도"),
    task: text(row, "과제"),
    plan: text(row, "세부계획"),
    target: text(row, "Target"),
    weight: num(row, "비중"),
    selfRating: text(row, "자기평가등급"),
  }));
}

export function getPerformanceReviews(): ReviewProfile[] {
  return readRows("performance_reviews_3y.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    year: num(row, "평가연도"),
    rating: text(row, "평가등급"),
    system: text(row, "평가체계"),
    org: text(row, "평가조직"),
  }));
}

export function getAppointments(): AppointmentProfile[] {
  return readRows("appointments.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    date: text(row, "발령일자"),
    type: text(row, "발령구분"),
    reason: text(row, "발령사유코드"),
    afterOrg: text(row, "발령후_소속"),
    afterRoleLevel: text(row, "발령후_R/L"),
    afterPosition: text(row, "발령후_직책"),
  }));
}

export function getRawDataSummary(memberId: string) {
  const education = getEducationJobProfiles().find((row) => row.employee_id === memberId) ?? null;
  const piTasks = getPiTasks()
    .filter((row) => row.employee_id === memberId)
    .sort((a, b) => b.year - a.year || b.weight - a.weight)
    .slice(0, 5);
  const reviews = getPerformanceReviews()
    .filter((row) => row.employee_id === memberId)
    .sort((a, b) => b.year - a.year);
  const appointments = getAppointments()
    .filter((row) => row.employee_id === memberId)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    education,
    piTasks,
    reviews,
    latestAppointment: appointments.at(-1) ?? null,
  };
}
