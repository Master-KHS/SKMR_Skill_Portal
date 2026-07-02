const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const XLSX = require(path.join(ROOT, "web", "node_modules", "xlsx"));
const MEMBERS_PATH = path.join(ROOT, "web", "data", "members.xlsx");
const OUTPUT_PATH = path.join(ROOT, "web", "data", "education_job_profile.xlsx");

const researchSchools = [
  "서울대학교",
  "KAIST",
  "POSTECH",
  "연세대학교",
  "고려대학교",
  "성균관대학교",
  "한양대학교",
  "UNIST",
  "DGIST",
  "경북대학교",
];

const engineeringSchools = [
  "서울대학교",
  "KAIST",
  "POSTECH",
  "연세대학교",
  "고려대학교",
  "성균관대학교",
  "한양대학교",
  "부산대학교",
  "경북대학교",
  "인하대학교",
  "아주대학교",
];

const generalSchools = [
  "고려대학교",
  "연세대학교",
  "성균관대학교",
  "한양대학교",
  "중앙대학교",
  "경희대학교",
  "건국대학교",
  "동국대학교",
  "한국외국어대학교",
  "서울시립대학교",
];

const majors = {
  material: ["화학과", "화학공학과", "신소재공학과", "고분자공학과", "재료공학과"],
  facility: ["기계공학과", "전기공학과", "전자공학과", "제어계측공학과", "산업공학과"],
  process: ["화학공학과", "산업공학과", "시스템경영공학과", "공업화학과", "기계공학과"],
  quality: ["화학공학과", "산업공학과", "통계학과", "품질경영학과", "신소재공학과"],
  executive: ["경영학과", "산업공학과", "화학공학과"],
};

const jobPools = {
  소재개발팀: ["소재평가"],
  소재개발팀2: ["소재평가"],
  설비기술팀: ["기계/배관", "전기/계기", "엔지니어링 일반"],
  공정기술팀: ["공정엔지니어링", "생산기술", "생산전략"],
  제조기술팀: ["품질기술", "품질관리"],
  사업대표: ["사업전략"],
  "Skill Committee": ["Skill 진단 운영"],
};

const fixedProfiles = {
  임가영: {
    job: "소재평가",
    education: "대학원(석사)",
    school: "고려대학교",
    major: "화학 및 화학공학 화학과",
  },
  김선재: {
    job: "소재평가",
    education: "대학원(석사)",
    school: "고려대학교",
    major: "화학 및 화학공학 화학과",
  },
};

function seededNumber(seed) {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function pick(list, seed) {
  return list[seededNumber(seed) % list.length];
}

function readMembers() {
  const wb = XLSX.read(fs.readFileSync(MEMBERS_PATH), { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

function domainFor(member) {
  if (member["팀"] === "소재개발팀" || member["팀"] === "소재개발팀2") return "material";
  if (member["팀"] === "설비기술팀") return "facility";
  if (member["팀"] === "공정기술팀") return "process";
  if (member["팀"] === "제조기술팀") return "quality";
  return "executive";
}

function schoolPoolFor(member, domain) {
  if (member["직종"] === "연구직" || domain === "material") return researchSchools;
  if (member["직종"] === "기술직" || ["facility", "process", "quality"].includes(domain)) return engineeringSchools;
  return generalSchools;
}

function educationFor(member, seed) {
  if (member["R/L"] === "임원") return pick(["대학원(석사)", "대학원(박사)", "대학교(학사)"], seed);
  if (member["직종"] === "연구직") return pick(["대학원(석사)", "대학원(석사)", "대학원(박사)", "대학교(학사)"], seed);
  if (member["R/L"] === "L5" || member["R/L"] === "L6") return pick(["대학교(학사)", "대학원(석사)", "대학원(석사)"], seed);
  return pick(["대학교(학사)", "대학교(학사)", "대학원(석사)"], seed);
}

function profileFor(member) {
  if (fixedProfiles[member["이름"]]) return fixedProfiles[member["이름"]];
  const seed = `${member["사번"]}:${member["이름"]}:${member["팀"]}`;
  const domain = domainFor(member);
  const job = pick(jobPools[member["팀"]] || ["직무 일반"], `${seed}:job`);
  return {
    job,
    education: educationFor(member, `${seed}:education`),
    school: pick(schoolPoolFor(member, domain), `${seed}:school`),
    major: pick(majors[domain], `${seed}:major`),
  };
}

const rows = readMembers().map((member) => {
  const profile = profileFor(member);
  return {
    사번: member["사번"],
    이름: member["이름"],
    법인: member["법인"],
    담당: member["담당"],
    팀: member["팀"],
    "R/L": member["R/L"],
    직책: member["직책"],
    직종: member["직종"],
    직무: profile.job,
    최종학력: profile.education,
    학교명: profile.school,
    전공: profile.major,
  };
});

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "education_job_profile");
fs.writeFileSync(OUTPUT_PATH, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

console.log(JSON.stringify({
  output: OUTPUT_PATH,
  rows: rows.length,
  fixed: rows.filter((row) => ["임가영", "김선재"].includes(row["이름"])),
}));
