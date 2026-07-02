const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const XLSX = require(path.join(ROOT, "web", "node_modules", "xlsx"));
const WEB_DATA = path.join(ROOT, "web", "data");
const ROOT_DATA = path.join(ROOT, "data");
const MEMBERS_PATHS = [path.join(WEB_DATA, "members.xlsx"), path.join(ROOT_DATA, "members.xlsx")];
const APPOINTMENTS_PATH = path.join(WEB_DATA, "appointments.xlsx");
const REVIEWS_PATH = path.join(WEB_DATA, "performance_reviews_3y.xlsx");
const BASE_YEAR = 2026;

const KO = {
  id: "사번",
  name: "이름",
  corporation: "법인",
  division: "담당",
  team: "팀",
  role: "R/L",
  tenure: "R/L 연차",
  position: "직책",
  job: "직종",
  persona: "페르소나",
};

const EN_TO_KO = {
  employee_id: KO.id,
  name: KO.name,
  corporation: KO.corporation,
  division: KO.division,
  team: KO.team,
  role_level: KO.role,
  role_tenure: KO.tenure,
  position: KO.position,
  job_type: KO.job,
  persona_role: KO.persona,
};

const NAME_RENAMES = new Map([
  ["임수아", "임가영"],
  ["남준민", "김선재"],
]);

const TENURE_OVERRIDES = new Map([
  ["임가영", 3],
  ["김선재", 5],
]);

function readRows(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  return { sheetName, rows: XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" }) };
}

function writeRows(filePath, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function seededNumber(seed) {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function roleLevelNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 3;
}

function asKoRow(row) {
  const out = { ...row };
  for (const [en, ko] of Object.entries(EN_TO_KO)) {
    if (!(ko in out) && en in out) out[ko] = out[en];
  }
  if (NAME_RENAMES.has(out[KO.name])) out[KO.name] = NAME_RENAMES.get(out[KO.name]);
  return out;
}

function backToOriginalShape(original, koRow) {
  const out = { ...original };
  for (const key of Object.values(KO)) {
    if (key in original || Object.keys(original).some((k) => EN_TO_KO[k] === key)) out[key] = koRow[key] ?? "";
  }
  for (const [en, ko] of Object.entries(EN_TO_KO)) {
    if (en in original) out[en] = koRow[ko] ?? "";
  }
  return out;
}

function tenureFor(row) {
  const name = row[KO.name];
  if (TENURE_OVERRIDES.has(name)) return TENURE_OVERRIDES.get(name);
  if (row[KO.position] === "팀장") return 3;
  const n = seededNumber(row[KO.id]);
  const level = roleLevelNumber(row[KO.role]);
  if (level <= 3) return (n % 3) + 1;
  if (level === 4) return (n % 8) + 1;
  return (n % 10) + 1;
}

function normalizeMembers() {
  const result = [];
  for (const filePath of MEMBERS_PATHS) {
    if (!fs.existsSync(filePath)) continue;
    const { sheetName, rows } = readRows(filePath);
    const updated = rows.map((row) => {
      const ko = asKoRow(row);
      ko[KO.tenure] = tenureFor(ko);
      return backToOriginalShape(row, ko);
    });
    writeRows(filePath, sheetName, updated);
    result.push({ filePath, rows: updated.length });
  }
  return result;
}

function ymd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addEnd(date) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function previousLevel(level, step) {
  return `L${Math.max(2, level - step)}`;
}

function org(row) {
  return `${row[KO.division]}-${row[KO.team]}`;
}

function profile(row) {
  return {
    [KO.id]: row[KO.id],
    [KO.name]: row[KO.name],
    [KO.corporation]: row[KO.corporation],
    [KO.division]: row[KO.division],
    [KO.team]: row[KO.team],
    [KO.role]: row[KO.role],
    [KO.tenure]: row[KO.tenure],
    [KO.position]: row[KO.position],
    [KO.job]: row[KO.job],
  };
}

function hireReason(index) {
  return ["신입", "경력", "그룹전입", "기타"][index % 4];
}

function appointmentRow(row, event) {
  return {
    ...profile(row),
    발령일자: event.date,
    발령구분: event.type,
    발령사유코드: event.reason,
    시작일자: event.start,
    종료일자: event.end || "",
    발령전_소속: event.beforeOrg || "",
    "발령전_R/L": event.beforeLevel || "",
    발령전_직책: event.beforePosition || "",
    발령후_소속: event.afterOrg,
    발령후_팀: row[KO.team],
    "발령후_R/L": event.afterLevel,
    발령후_직책: event.afterPosition,
    비고: event.note || "",
  };
}

function makeAppointments(members) {
  const rows = [];
  members.forEach((member, index) => {
    const level = roleLevelNumber(member[KO.role]);
    const tenure = Number(member[KO.tenure] || tenureFor(member));
    const currentOrg = org(member);
    const currentPosition = member[KO.position] || "팀원";
    const finalStart = ymd(BASE_YEAR - tenure, ((index % 12) + 1), 1 + (index % 20));
    const events = [];

    if (level <= 3) {
      events.push({
        date: finalStart,
        type: "채용",
        reason: hireReason(index),
        start: finalStart,
        afterOrg: currentOrg,
        afterLevel: member[KO.role],
        afterPosition: currentPosition,
        note: "최초 발령 및 현재 R/L 기준",
      });
    } else if (level === 4) {
      const hire = ymd(BASE_YEAR - tenure - 3, ((index % 12) + 1), 1 + (index % 20));
      events.push({
        date: hire,
        type: "채용",
        reason: hireReason(index),
        start: hire,
        end: addEnd(finalStart),
        afterOrg: currentOrg,
        afterLevel: "L3",
        afterPosition: "팀원",
        note: "최초 발령",
      });
      events.push({
        date: finalStart,
        type: "승진",
        reason: "승진",
        start: finalStart,
        beforeOrg: currentOrg,
        beforeLevel: "L3",
        beforePosition: "팀원",
        afterOrg: currentOrg,
        afterLevel: member[KO.role],
        afterPosition: currentPosition,
        note: "현재 R/L 연차 기준 최종 발령",
      });
    } else {
      const midStart = ymd(BASE_YEAR - tenure - 3, ((index % 12) + 1), 1 + (index % 20));
      const hire = ymd(BASE_YEAR - tenure - 6, ((index % 12) + 1), 1 + (index % 20));
      events.push({
        date: hire,
        type: "채용",
        reason: hireReason(index),
        start: hire,
        end: addEnd(midStart),
        afterOrg: currentOrg,
        afterLevel: previousLevel(level, 2),
        afterPosition: "팀원",
        note: "최초 발령",
      });
      events.push({
        date: midStart,
        type: "승진",
        reason: "승진",
        start: midStart,
        end: addEnd(finalStart),
        beforeOrg: currentOrg,
        beforeLevel: previousLevel(level, 2),
        beforePosition: "팀원",
        afterOrg: currentOrg,
        afterLevel: previousLevel(level, 1),
        afterPosition: "팀원",
        note: "중간 승진 이력",
      });
      events.push({
        date: finalStart,
        type: "승진",
        reason: "승진",
        start: finalStart,
        beforeOrg: currentOrg,
        beforeLevel: previousLevel(level, 1),
        beforePosition: "팀원",
        afterOrg: currentOrg,
        afterLevel: member[KO.role],
        afterPosition: currentPosition,
        note: "현재 R/L 연차 기준 최종 발령",
      });
    }

    events.forEach((event) => rows.push(appointmentRow(member, event)));
  });
  writeRows(APPOINTMENTS_PATH, "appointments", rows);
  return rows;
}

function ratingFor(member, year, rankInDivision, divisionCount) {
  if (member[KO.position] === "팀장") {
    const ratings = ["A", "B", "A"];
    return ratings[(year + seededNumber(member[KO.id])) % ratings.length];
  }
  const cutoff = Math.max(1, Math.round(divisionCount * 0.2));
  return rankInDivision < cutoff ? "EE" : "ME";
}

function makeReviews(members) {
  const years = [2023, 2024, 2025];
  const rows = [];
  for (const year of years) {
    const byDivision = new Map();
    members.forEach((member) => {
      const key = member[KO.division] || "미지정";
      if (!byDivision.has(key)) byDivision.set(key, []);
      byDivision.get(key).push(member);
    });

    for (const [division, group] of byDivision.entries()) {
      const ranked = [...group].sort(
        (a, b) => seededNumber(`${year}:${a[KO.id]}`) - seededNumber(`${year}:${b[KO.id]}`)
      );
      ranked.forEach((member, rank) => {
        const rating = ratingFor(member, year, rank, ranked.length);
        rows.push({
          ...profile(member),
          평가연도: year,
          평가조직: division,
          평가등급: rating,
          평가체계: member[KO.position] === "팀장" ? "SABC" : "EE/ME",
          상대평가그룹: division,
          비고: member[KO.position] === "팀장" ? "팀장 보임 이후 A/B 중심 더미" : "담당조직 기준 상대평가 더미",
        });
      });
    }
  }
  writeRows(REVIEWS_PATH, "performance_reviews_3y", rows);
  return rows;
}

const normalized = normalizeMembers();
const members = readRows(path.join(WEB_DATA, "members.xlsx")).rows.map(asKoRow);
const appointments = makeAppointments(members);
const reviews = makeReviews(members);

console.log(JSON.stringify({
  normalized,
  appointments: { path: APPOINTMENTS_PATH, rows: appointments.length },
  reviews: { path: REVIEWS_PATH, rows: reviews.length },
}));
