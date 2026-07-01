// 파일 기반 문서 RAG (서버 전용) — 앱 폴더의 docs/ 안 문서를 실행 중에 읽어 검색.
// 지원: .txt .md (텍스트) / .csv .xlsx .xls (표). DB에 넣지 않고 파일을 직접 읽음.
import "server-only";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const DOCS_DIR = path.join(process.cwd(), "docs");
const TEXT_EXT = new Set([".txt", ".md"]);
const TABLE_EXT = new Set([".csv", ".xlsx", ".xls"]);

export interface DocChunk {
  file: string;
  loc: string; // 위치 표기 (줄/시트/행)
  text: string;
}

export function listDocFiles(): string[] {
  try {
    return fs
      .readdirSync(DOCS_DIR)
      .filter((f) => {
        const e = path.extname(f).toLowerCase();
        return TEXT_EXT.has(e) || TABLE_EXT.has(e);
      })
      .sort();
  } catch {
    return [];
  }
}

// 파일을 청크 배열로 변환
function readChunks(file: string): DocChunk[] {
  const full = path.join(DOCS_DIR, file);
  const ext = path.extname(file).toLowerCase();
  const chunks: DocChunk[] = [];
  try {
    if (TEXT_EXT.has(ext)) {
      const raw = fs.readFileSync(full, "utf-8");
      // 빈 줄 기준 문단 분할
      const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      paras.forEach((p, i) => chunks.push({ file, loc: `문단 ${i + 1}`, text: p.slice(0, 800) }));
    } else if (TABLE_EXT.has(ext)) {
      // XLSX.readFile()은 Next.js 번들 환경에서 fs 감지가 깨질 수 있어, 버퍼를 직접 넘김.
      const wb = ext === ".csv"
        ? XLSX.read(fs.readFileSync(full, "utf-8"), { type: "string" })
        : XLSX.read(fs.readFileSync(full), { type: "buffer" });
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        // 각 행을 "컬럼:값" 텍스트로 (표 데이터를 자연어처럼 검색 가능하게)
        rows.forEach((row, i) => {
          const text = Object.entries(row)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
          if (text.trim()) chunks.push({ file, loc: `${sheetName} ${i + 2}행`, text: text.slice(0, 800) });
        });
      }
    }
  } catch {
    // 읽기 실패 파일은 건너뜀
  }
  return chunks;
}

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[가-힣a-z0-9]+/g) ?? []).filter((t) => t.length >= 2);
}

// 키워드 겹침 점수로 상위 k개 청크 반환
export function searchDocs(queryText: string, k = 6): DocChunk[] {
  const qTokens = new Set(tokenize(queryText));
  if (qTokens.size === 0) return [];
  const all: DocChunk[] = [];
  for (const f of listDocFiles()) all.push(...readChunks(f));

  const scored = all.map((c) => {
    const cTokens = tokenize(c.text);
    let score = 0;
    for (const t of cTokens) if (qTokens.has(t)) score += 1;
    // 부분 문자열 보너스 (한글 미분절 대응)
    for (const q of qTokens) if (q.length >= 2 && c.text.toLowerCase().includes(q)) score += 0.5;
    return { c, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}
