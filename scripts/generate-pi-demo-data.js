const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const XLSX = require(path.join(ROOT, "web", "node_modules", "xlsx"));
const MEMBERS_PATH = path.join(ROOT, "web", "data", "members.xlsx");
const OUTPUT_PATH = path.join(ROOT, "web", "data", "pi_tasks_3y.xlsx");

const YEARS = [2023, 2024, 2025];
const EXCLUDED_TEAMS = new Set([""]);

const templates = {
  공정기술팀: [
    {
      task: "중장기 제조기반 구축 - 공정진단",
      plan: "MP(Photo/AP), TC 대상 공정 진단 완료 및 개선점 발굴",
      target: "MP(Photo/TC) 공정진단 완료 및 개선안 도출",
      weight: 15,
    },
    {
      task: "중장기 제조기반 구축 - Ideal Plant 개념 설계",
      plan: "Design Note 및 Package 개발, 기존 Engineering Document Review, Conceptual BDP 작성",
      target: "Design Note 작성 및 Conceptual BDP/Report 지원 완료",
      weight: 40,
    },
    {
      task: "중점 이슈과제 수행",
      plan: "CV batch mode 시운전, Continuous mode 양산 조건 확보, 운영 안정화 지원",
      target: "핵심 공정 이슈 개선 및 Target 일정 준수",
      weight: 35,
    },
    {
      task: "SHE",
      plan: "안전세미나 참석, Safety Talk 참여, 생활안전 준수",
      target: "SHE 참여율 100%",
      weight: 7,
    },
    {
      task: "행복",
      plan: "역량세미나 시행 및 조직문화 활동 참여",
      target: "연 2회 이상 참여",
      weight: 3,
    },
  ],
  설비기술팀: [
    {
      task: "자회사 중장기 제조기반 구축",
      plan: "설비 진단 Check List 작성, 기계 Reliability 진단, Vendor Pool 다변화",
      target: "진단보고서 작성 및 Reliability 개선 과제 발굴",
      weight: 15,
    },
    {
      task: "Ideal Plant 개념설계 - Design Note 및 Package 개발",
      plan: "Engineering 성과품 취합, Rotating As-Built 도서 정리, Conceptual Design Package 작성",
      target: "Design Note 2건 이상 작성 및 Conceptual Design Package 진도율 100%",
      weight: 20,
    },
    {
      task: "중점 이슈과제 수행",
      plan: "OIMS 과제 관리, 투자비 적정성 검토, 양산 안정화 지원",
      target: "Target 일정 준수",
      weight: 15,
    },
    {
      task: "시설 인프라 관리체계 구축",
      plan: "Infra 관리 체계 구축, 시설 현황 파악, 안전조치 시행 및 공사 관리",
      target: "시설 Infra 관리 체계 구축 및 공사 기간 준수",
      weight: 35,
    },
    {
      task: "Eng. Doc 관리 수준 Upgrade",
      plan: "MDR 수립, Eng. Doc 관리 체계 수립, 문서 보완 및 관리 방안 적용",
      target: "MDR 수립 및 Document Control 체계 운영",
      weight: 15,
    },
  ],
  제조기술팀: [
    {
      task: "QC 항목 mTTM 절감",
      plan: "제품 선정 및 gap 분석 후 QC 적용/보완, 검증 항목 효율화",
      target: "고객사 선검증 fail 2회 이하 및 QC 산포 개선",
      weight: 20,
    },
    {
      task: "Photo공정 인프라 고도화",
      plan: "Coating method 변경, Recipe 표준화, Line PR Recipe 셋업",
      target: "산포 20% 개선 및 공정 표준화",
      weight: 20,
    },
    {
      task: "평가실 Paperless",
      plan: "PIMS Request/Proceeding sheet 전산화 및 Web page 환경 구축",
      target: "PIMS 신규 기능 개발 및 평가실 환경 구축",
      weight: 20,
    },
    {
      task: "가상계측 모델 고도화",
      plan: "데이터 가공 방법 정교화, 공정 중 검사 데이터 기록/관리 전산화",
      target: "조정횟수 20% 단축",
      weight: 20,
    },
    {
      task: "12 inch KrF infra 구축 완료",
      plan: "KrF Scanner, CD-SEM 셋업 및 최적화, 신규 장비 SAT 완료",
      target: "유효성 검증 및 장비 운영 안정화",
      weight: 20,
    },
  ],
  소재개발팀: [
    {
      task: "Photo Resist 신소재 개발/육성",
      plan: "NAND 및 Undercut-free C/H용 Nega Photo Resist 개발, 조성 확보 및 Gallon 평가 진행",
      target: "Photo Resist 2차 Gallon 평가 완료",
      weight: 20,
    },
    {
      task: "신규 소재 후보 확보",
      plan: "원재료 평가, Split 평가, High Aspect Ratio 조건 검토",
      target: "소재 Library 확보 및 후보 조성 선정",
      weight: 10,
    },
    {
      task: "고객 협업을 통한 고객 양산 Pain-point 해소",
      plan: "PR PAD 및 KrF Photo Resist 개발, 고객 샘플 대응, 성능 평가 확인",
      target: "Photo Resist 고객 평가 결과 확보 및 성능 개선",
      weight: 20,
    },
    {
      task: "Global expansion 가속화",
      plan: "해외 고객 Batch 재현성 평가, CIP Gallon 제출, Volume 평가 대응",
      target: "소재 선정 및 고객 Qualification 진입",
      weight: 50,
    },
    {
      task: "양산 이관",
      plan: "양산 전환 샘플 평가, Batch 안정성 확인, Audit 대응",
      target: "양산 이관 완료",
      weight: 15,
    },
  ],
  소재개발팀2: [
    {
      task: "BD Simulation",
      plan: "BD 개발품 simulation 의뢰 및 신규 재료 계산 의뢰",
      target: "BD 신규 재료 계산 20종 이상 및 후보 조성 도출",
      weight: 5,
    },
    {
      task: "SHE 공통 과제",
      plan: "SHE 과제 수행, SHE 법규 위반 개선, 근로자 참여 위험개선 활동",
      target: "SHE Target 100% 달성",
      weight: 5,
    },
    {
      task: "IP 경쟁력 강화 및 신규 출원 확대",
      plan: "특허 신규 출원, IP 포트폴리오 보완 및 확장, 협력사 특허 기반 연구",
      target: "특허 출원 및 IP Portfolio 보완 완료",
      weight: 10,
    },
    {
      task: "개인 부업무",
      plan: "분석기기 유지보수, LCMS/HPLC 관리, Calibration 및 연구소 폐수 관리",
      target: "분석기기 Look Back 평가 및 유지보수 관리 완료",
      weight: 15,
    },
    {
      task: "Blue Dopant R&D 가속화",
      plan: "OLED Blue Dopant 신규 물질 개발, 합성 데이터 정리, 고객 평가 샘플 제출",
      target: "Blue Dopant 후보 물질 선정 및 고객 평가 진입",
      weight: 65,
    },
  ],
  사업대표: [
    {
      task: "사업 전략 및 성과 관리",
      plan: "연간 사업 목표 수립, 핵심 성과지표 점검, 조직별 실행 이슈 관리",
      target: "사업 목표 달성 및 주요 리스크 선제 대응",
      weight: 30,
    },
    {
      task: "핵심 인재 및 조직 역량 강화",
      plan: "핵심 인력 육성, 리더십 점검, 조직별 역량 개발 과제 관리",
      target: "핵심 인재 유지 및 조직 역량 개선",
      weight: 20,
    },
    {
      task: "고객 및 시장 대응",
      plan: "주요 고객 대응, 신규 기회 발굴, 시장 변화 대응 전략 수립",
      target: "고객 이슈 대응 및 신규 성장 기회 확보",
      weight: 20,
    },
    {
      task: "운영 리스크 관리",
      plan: "품질, SHE, 공급망, 투자 리스크 점검 및 개선 과제 관리",
      target: "주요 운영 리스크 Zero화",
      weight: 20,
    },
    {
      task: "협업 문화 및 일하는 방식 개선",
      plan: "담당 간 협업 체계 정비, 의사결정 속도 개선, 조직문화 활동 지원",
      target: "협업 만족도 및 실행 속도 개선",
      weight: 10,
    },
  ],
  "Skill Committee": [
    {
      task: "Skill 진단 기준 운영",
      plan: "Skill Level 기준 검토, 평가 문구 정합성 점검, 진단 운영 원칙 관리",
      target: "Skill 진단 기준 정합성 확보",
      weight: 25,
    },
    {
      task: "Calibration 및 Committee 운영",
      plan: "Calibration 결과 검토, Committee 심의 대상 점검, 최종 확정 프로세스 운영",
      target: "진단 결과 확정 및 이의사항 최소화",
      weight: 25,
    },
    {
      task: "핵심 Skill Pool 관리",
      plan: "전사/조직별 Core Skill 현황 점검, Skill Gap 분석, 육성 우선순위 도출",
      target: "핵심 Skill Pool 가시성 확보",
      weight: 20,
    },
    {
      task: "리포팅 및 의사결정 지원",
      plan: "Dashboard 지표 점검, 인재 검색 결과 검토, 경영진 보고자료 지원",
      target: "경영진 의사결정 지원 자료 적시 제공",
      weight: 20,
    },
    {
      task: "운영 품질 개선",
      plan: "진단 운영 오류 점검, 권한/범위 정책 개선, 사용자 피드백 반영",
      target: "운영 오류 및 사용자 불편 최소화",
      weight: 10,
    },
  ],
};

const memberTemplates = {
  임가영: [
    {
      task: "Photo Resist 평가 Part 공정 표준 제정",
      plan: "Photo 공정 OCAP, Recipe naming rule, PM 문서 및 Run-sheet 표준화",
      target: "Photo Resist 평가 공정 표준 제정 100%",
      weight: 20,
    },
    {
      task: "Photo Resist CD 산포 개선",
      plan: "QC Reticle 관리, Lens 정중앙 사용, PR Recipe 및 Wafer QC map 최적화",
      target: "Photo Resist CD 산포 20% 감소",
      weight: 20,
    },
    {
      task: "Litho 장비 PM 고도화",
      plan: "TRACK/노광 장비 PM 상관성 분석, CTQ 발굴 및 관리 체계 최적화",
      target: "Photo Resist Litho PM 수행률 100%",
      weight: 20,
    },
    {
      task: "Photo Resist Thickness 산포 개선",
      plan: "TRACK 수립, Mark/ACT/Recipe 최적화, In-line 제품별 산포 관리",
      target: "Photo Resist Thickness 산포 20% 감소",
      weight: 20,
    },
    {
      task: "Photo Resist 신규 장비 셋업 및 안정화",
      plan: "12 inch 신규 장비 대상 평가 Recipe 정립, 양산 제품 셋업 및 안정화",
      target: "Photo Resist 평가 장비 운영 안정화",
      weight: 20,
    },
  ],
};

function readMembers() {
  const wb = XLSX.read(fs.readFileSync(MEMBERS_PATH), { type: "buffer" });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
}

function seededRating(memberId, year, index) {
  const ratings = ["A", "A", "B", "B", "S"];
  let hash = 0;
  for (const ch of `${memberId}:${year}:${index}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ratings[hash % ratings.length];
}

function templateFor(team) {
  return templates[team] || templates["Skill Committee"];
}

const members = readMembers().filter((row) => !EXCLUDED_TEAMS.has(row["팀"]));
const rows = [];

for (const member of members) {
  const teamTemplates = memberTemplates[member["이름"]] || templateFor(member["팀"]);
  for (const year of YEARS) {
    teamTemplates.forEach((item, index) => {
      rows.push({
        사번: member["사번"],
        이름: member["이름"],
        법인: member["법인"],
        담당: member["담당"],
        팀: member["팀"],
        "R/L": member["R/L"],
        "R/L 연차": member["R/L 연차"],
        직책: member["직책"],
        직종: member["직종"],
        평가연도: year,
        KPI번호: index + 1,
        과제: item.task,
        세부계획: item.plan,
        Target: item.target,
        비중: item.weight,
        자기평가등급: seededRating(member["사번"], year, index),
        자기평가의견: `${year}년 ${member["팀"]} PI 과제 수행 결과를 기준으로 작성한 시연용 더미 의견입니다.`,
        진행상태: "완료",
        데이터출처: "이미지 참고 기반 더미 생성",
      });
    });
  }
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "pi_tasks_3y");
fs.writeFileSync(OUTPUT_PATH, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

console.log(JSON.stringify({
  output: OUTPUT_PATH,
  members: members.length,
  rows: rows.length,
  teams: [...new Set(members.map((row) => row["팀"]))],
}));
