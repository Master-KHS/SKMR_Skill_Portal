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

let educationProfilesCache: EducationJobProfile[] | null = null;
let piTasksCache: PiTaskProfile[] | null = null;
let performanceReviewsCache: ReviewProfile[] | null = null;
let appointmentsCache: AppointmentProfile[] | null = null;

let rawSummaryCache:
  | Map<
      string,
      {
        education: EducationJobProfile | null;
        piTasks: PiTaskProfile[];
        reviews: ReviewProfile[];
        latestAppointment: AppointmentProfile | null;
      }
    >
  | null = null;

export function getEducationJobProfiles(): EducationJobProfile[] {
  if (educationProfilesCache) return educationProfilesCache;
  educationProfilesCache = readRows("education_job_profile.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    job: text(row, "직무"),
    education: text(row, "최종학력"),
    school: text(row, "학교명"),
    major: text(row, "전공"),
  }));
  return educationProfilesCache;
}

export function getPiTasks(): PiTaskProfile[] {
  if (piTasksCache) return piTasksCache;
  piTasksCache = readRows("pi_tasks_3y.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    year: num(row, "평가연도"),
    task: text(row, "과제"),
    plan: text(row, "세부계획"),
    target: text(row, "Target"),
    weight: num(row, "비중"),
    selfRating: text(row, "자기평가등급"),
  }));
  return piTasksCache;
}

export function getPerformanceReviews(): ReviewProfile[] {
  if (performanceReviewsCache) return performanceReviewsCache;
  performanceReviewsCache = readRows("performance_reviews_3y.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    year: num(row, "평가연도"),
    rating: text(row, "평가등급"),
    system: text(row, "평가체계"),
    org: text(row, "평가조직"),
  }));
  return performanceReviewsCache;
}

export function getAppointments(): AppointmentProfile[] {
  if (appointmentsCache) return appointmentsCache;
  appointmentsCache = readRows("appointments.xlsx").map((row) => ({
    employee_id: text(row, "사번"),
    name: text(row, "이름"),
    date: text(row, "발령일자"),
    type: text(row, "발령구분"),
    reason: text(row, "발령사유코드"),
    afterOrg: text(row, "발령후소속"),
    afterRoleLevel: text(row, "발령후R/L"),
    afterPosition: text(row, "발령후직책"),
  }));
  return appointmentsCache;
}

function buildRawSummaryCache() {
  if (rawSummaryCache) return rawSummaryCache;

  const educationById = new Map(getEducationJobProfiles().map((row) => [row.employee_id, row]));
  const piTasksById = new Map<string, PiTaskProfile[]>();
  const reviewsById = new Map<string, ReviewProfile[]>();
  const appointmentsById = new Map<string, AppointmentProfile[]>();

  for (const row of getPiTasks()) {
    const list = piTasksById.get(row.employee_id) ?? [];
    list.push(row);
    piTasksById.set(row.employee_id, list);
  }
  for (const row of getPerformanceReviews()) {
    const list = reviewsById.get(row.employee_id) ?? [];
    list.push(row);
    reviewsById.set(row.employee_id, list);
  }
  for (const row of getAppointments()) {
    const list = appointmentsById.get(row.employee_id) ?? [];
    list.push(row);
    appointmentsById.set(row.employee_id, list);
  }

  rawSummaryCache = new Map();
  const allIds = new Set([
    ...educationById.keys(),
    ...piTasksById.keys(),
    ...reviewsById.keys(),
    ...appointmentsById.keys(),
  ]);

  for (const employeeId of allIds) {
    const piTasks = (piTasksById.get(employeeId) ?? [])
      .slice()
      .sort((a, b) => b.year - a.year || b.weight - a.weight)
      .slice(0, 5);
    const reviews = (reviewsById.get(employeeId) ?? []).slice().sort((a, b) => b.year - a.year);
    const appointments = (appointmentsById.get(employeeId) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));

    rawSummaryCache.set(employeeId, {
      education: educationById.get(employeeId) ?? null,
      piTasks,
      reviews,
      latestAppointment: appointments.at(-1) ?? null,
    });
  }

  return rawSummaryCache;
}

export function getRawDataSummary(memberId: string) {
  return (
    buildRawSummaryCache().get(memberId) ?? {
      education: null,
      piTasks: [],
      reviews: [],
      latestAppointment: null,
    }
  );
}
