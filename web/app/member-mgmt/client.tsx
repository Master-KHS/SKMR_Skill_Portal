"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { usePersona } from "@/components/PersonaContext";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { PERSONA_LABELS } from "@/lib/nav";
import type { Member, PersonaCode } from "@/lib/types";

const XLS_COLS: [keyof Member, string][] = [
  ["employee_id", "사번"],
  ["name", "이름"],
  ["corporation", "법인"],
  ["division", "담당"],
  ["team", "팀"],
  ["role_level", "R/L"],
  ["position", "직책"],
  ["job_type", "직종"],
  ["persona_role", "페르소나"],
];

const ROLE_LEVELS = ["L6", "L5", "L4", "L3", "L2", "임원"];
const POSITIONS = ["팀장", "팀원", "임원", "대표"];
const JOB_TYPES = ["사무직", "기술직", "연구직", "경영"];
const PERSONAS = ["", ...Object.keys(PERSONA_LABELS)];

type Row = Member & { _new?: boolean };
type SourceMeta = {
  mode: string;
  relativePath: string;
  absolutePath: string;
};

export function MemberMgmtClient() {
  const { persona } = usePersona();
  const isEditor = persona === "hr_admin";
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceMeta | null>(null);
  const [divisionFilter, setDivisionFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [roleLevelFilter, setRoleLevelFilter] = useState("");
  const [target, setTarget] = useState(300);
  const [generating, setGenerating] = useState(false);

  async function load() {
    const res = await fetch("/api/members");
    const data = await res.json();
    setRows(data.members ?? []);
    setSource(data.source ?? null);
    setDirty(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateRow(index: number, field: keyof Member, value: string) {
    if (!isEditor) return;
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setDirty(true);
  }

  function addRow() {
    if (!isEditor) return;
    setRows((current) => [
      {
        employee_id: "",
        name: "",
        corporation: "SK머티리얼즈",
        division: "",
        team: "",
        role_level: "L3",
        position: "팀원",
        job_type: "사무직",
        persona_role: "employee",
        extra_attrs: null,
        _new: true,
      },
      ...current,
    ]);
    setDirty(true);
  }

  function deleteRow(index: number) {
    if (!isEditor) return;
    setRows((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  }

  async function save() {
    if (!isEditor) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: rows }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.ok) {
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    setSource(data.source ?? null);
    setMessage(`저장 완료 · ${data.saved}명 반영`);
    load();
  }

  async function generateMembers() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/gen-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!data.ok) {
      setError(data.error ?? "생성에 실패했습니다.");
      return;
    }
    setMessage(`샘플 생성 완료 · 총 ${data.total}명 (추가 ${data.added}명)`);
    load();
  }

  async function removeGeneratedMembers() {
    if (!confirm("자동 생성 인원(G로 시작)을 모두 삭제할까요?")) return;
    setGenerating(true);
    const res = await fetch("/api/gen-members", { method: "DELETE" });
    const data = await res.json();
    setGenerating(false);
    if (!data.ok) {
      setError(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    setMessage(`생성 인원 삭제 완료 · 총 ${data.total}명`);
    load();
  }

  function exportExcel() {
    const aoa = [
      XLS_COLS.map(([, label]) => label),
      ...rows.map((row) => XLS_COLS.map(([field]) => (row[field] ?? "") as string)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "members");
    XLSX.writeFile(wb, "members.xlsx");
  }

  function importExcel(file: File) {
    if (!isEditor) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const labelToField = new Map(XLS_COLS.map(([field, label]) => [label, field]));
        const parsed = json
          .map((record) => {
            const row: Partial<Member> = {};
            for (const [key, value] of Object.entries(record)) {
              const field =
                labelToField.get(key.trim()) ??
                XLS_COLS.find(([fieldName]) => fieldName === key)?.[0];
              if (field) {
                (row as Record<string, unknown>)[field] = String(value).trim() || null;
              }
            }
            return { corporation: "SK머티리얼즈", extra_attrs: null, ...row } as Row;
          })
          .filter((row) => row.employee_id && row.name);

        if (!parsed.length) {
          setError("엑셀에서 유효한 데이터(사번/이름)를 찾지 못했습니다.");
          return;
        }
        setRows(parsed);
        setDirty(true);
        setError(null);
        setMessage(`엑셀 ${parsed.length}건을 불러왔습니다. 확인 후 저장해 주세요.`);
      } catch (err) {
        setError(`엑셀 읽기 실패: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const divisions = useMemo(
    () => [...new Set(rows.map((row) => row.division).filter(Boolean))] as string[],
    [rows],
  );
  const teams = useMemo(
    () => [...new Set(rows.map((row) => row.team).filter(Boolean))] as string[],
    [rows],
  );

  const view = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        (!divisionFilter || row.division === divisionFilter) &&
        (!teamFilter || row.team === teamFilter) &&
        (!jobFilter || row.job_type === jobFilter) &&
        (!roleLevelFilter || row.role_level === roleLevelFilter),
    );

  const filtered = Boolean(divisionFilter || teamFilter || jobFilter || roleLevelFilter);
  const evaluationTargetCount = rows.filter((row) => JOB_TYPES.slice(0, 3).includes(row.job_type ?? "")).length;
  const hrAdminCount = rows.filter((row) => row.persona_role === "hr_admin").length;
  const personaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.persona_role ?? "(없음)";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const inputClassName = "border border-border-soft bg-white px-1.5 py-1 text-xs w-full";

  return (
    <div>
      <PageHeader
        title="구성원 Master Data"
        desc="구성원 조회·편집(추가/수정/삭제) 후 저장 시 엑셀과 DB에 함께 반영됩니다."
      />

      <Card className="mb-4">
        <div className="text-[13px] text-text-muted">마스터 원본 파일</div>
        <code className="mt-1 block text-xs">
          {source?.absolutePath ?? source?.relativePath ?? "data/members.xlsx"}
        </code>
        <div className="mt-2 text-xs text-text-muted">
          구성원 마스터의 source of truth는 <b>data/members.xlsx</b> 입니다. 화면 저장 시
          엑셀과 DB가 함께 동기화됩니다.
        </div>
      </Card>

      <Card title="샘플 인원 대량 생성" className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-text-muted">목표 인원</span>
          <input
            type="number"
            min={1}
            max={2000}
            className="border border-border-soft bg-white px-2 py-1.5 text-sm w-24"
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
          <button
            className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
            onClick={generateMembers}
            disabled={generating}
          >
            {generating ? "생성 중..." : "대량 생성"}
          </button>
          <button
            className="border border-sk-red text-sk-red px-3 py-1.5 text-sm"
            onClick={removeGeneratedMembers}
            disabled={generating}
          >
            생성 인원 삭제
          </button>
          <span className="text-xs text-text-muted">
            현재 부족분만 자동 추가되며 스킬 프로필도 함께 생성됩니다.
          </span>
        </div>
      </Card>

      <Card title="엑셀 업로드 / 다운로드" className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button className="border border-border-soft px-3 py-1.5 text-sm" onClick={exportExcel}>
            엑셀 다운로드
          </button>
          {isEditor && (
            <label className="border border-sk-orange text-[#C45E00] px-3 py-1.5 text-sm font-medium cursor-pointer">
              엑셀 업로드
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) importExcel(file);
                  event.target.value = "";
                }}
              />
            </label>
          )}
          <span className="text-xs text-text-muted">
            업로드 시 그리드에 먼저 반영되고, 저장을 눌러야 엑셀과 DB가 확정됩니다.
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Stat label="총 인원" value={`${rows.length}명`} accent />
        <Stat label="평가 대상" value={`${evaluationTargetCount}명`} />
        <Stat label="팀 수" value={`${teams.length}개`} />
        <Stat label="HR Admin" value={`${hrAdminCount}명`} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-4 gap-3">
          <Filter label="담당" value={divisionFilter} onChange={setDivisionFilter} options={divisions} />
          <Filter label="팀" value={teamFilter} onChange={setTeamFilter} options={teams} />
          <Filter label="직종" value={jobFilter} onChange={setJobFilter} options={JOB_TYPES} />
          <Filter label="R/L" value={roleLevelFilter} onChange={setRoleLevelFilter} options={ROLE_LEVELS} />
        </div>
      </Card>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold">
          구성원 목록 ({view.length} / {rows.length})
        </h2>
        {isEditor && (
          <button
            className="border border-sk-orange text-[#C45E00] px-3 py-1 text-xs font-medium"
            onClick={addRow}
          >
            + 행 추가
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {dirty && <Badge tone="orange" label="변경됨" />}
          {isEditor ? (
            <button
              className="bg-sk-orange text-white px-4 py-1.5 text-sm font-bold disabled:opacity-40"
              onClick={save}
              disabled={saving || !dirty}
            >
              {saving ? "저장 중..." : "변경사항 저장"}
            </button>
          ) : (
            <Badge tone="neutral" label={`${PERSONA_LABELS[persona as PersonaCode]} 조회 전용`} />
          )}
        </div>
      </div>

      {filtered && (
        <div className="mb-2 text-xs text-[#9A6500] border border-warning bg-warning/[0.08] p-2">
          필터가 적용되어 있어도 저장은 <b>전체 인원</b> 기준으로 반영됩니다.
        </div>
      )}
      {!isEditor && (
        <div className="mb-2 border border-border-soft bg-white p-2 text-xs text-text-muted">
          화면 직접 편집은 HR Admin 권한에서만 가능합니다.
        </div>
      )}
      {message && <div className="mb-2 border border-success bg-success/[0.06] p-2 text-sm text-success">{message}</div>}
      {error && <div className="mb-2 border border-sk-red bg-sk-red/[0.06] p-2 text-sm text-sk-red">{error}</div>}

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-border-soft text-left text-text-muted">
                <th className="py-2 pr-2">사번*</th>
                <th className="py-2 pr-2">이름*</th>
                <th className="py-2 pr-2">법인</th>
                <th className="py-2 pr-2">담당</th>
                <th className="py-2 pr-2">팀</th>
                <th className="py-2 pr-2">R/L</th>
                <th className="py-2 pr-2">직책</th>
                <th className="py-2 pr-2">직종</th>
                <th className="py-2 pr-2">페르소나</th>
                <th className="py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {view.map(({ row, index }) => (
                <tr key={`${row.employee_id}-${index}`} className={`border-b border-border-soft ${row._new ? "bg-sk-orange/[0.05]" : ""}`}>
                  <td className="py-1 pr-2">
                    <input
                      className={inputClassName}
                      value={row.employee_id}
                      readOnly={!isEditor}
                      onChange={(event) => updateRow(index, "employee_id", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputClassName}
                      value={row.name}
                      readOnly={!isEditor}
                      onChange={(event) => updateRow(index, "name", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputClassName}
                      value={row.corporation ?? ""}
                      readOnly={!isEditor}
                      onChange={(event) => updateRow(index, "corporation", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputClassName}
                      value={row.division ?? ""}
                      readOnly={!isEditor}
                      onChange={(event) => updateRow(index, "division", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputClassName}
                      value={row.team ?? ""}
                      readOnly={!isEditor}
                      onChange={(event) => updateRow(index, "team", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className={inputClassName}
                      value={row.role_level ?? ""}
                      disabled={!isEditor}
                      onChange={(event) => updateRow(index, "role_level", event.target.value)}
                    >
                      {ROLE_LEVELS.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className={inputClassName}
                      value={row.position ?? ""}
                      disabled={!isEditor}
                      onChange={(event) => updateRow(index, "position", event.target.value)}
                    >
                      {POSITIONS.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className={inputClassName}
                      value={row.job_type ?? ""}
                      disabled={!isEditor}
                      onChange={(event) => updateRow(index, "job_type", event.target.value)}
                    >
                      {JOB_TYPES.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className={inputClassName}
                      value={row.persona_role ?? ""}
                      disabled={!isEditor}
                      onChange={(event) => updateRow(index, "persona_role", event.target.value)}
                    >
                      {PERSONAS.map((value) => (
                        <option key={value} value={value}>
                          {value ? PERSONA_LABELS[value as PersonaCode] : "(없음)"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1">
                    {isEditor && (
                      <button className="text-sk-red text-xs" onClick={() => deleteRow(index)}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="페르소나 매핑 현황">
        <table className="w-full text-sm">
          <tbody>
            {personaCounts.map(([personaCode, count]) => (
              <tr key={personaCode} className="border-b border-border-soft last:border-0">
                <td className="py-1.5">
                  {personaCode in PERSONA_LABELS
                    ? PERSONA_LABELS[personaCode as PersonaCode]
                    : personaCode}
                </td>
                <td className="py-1.5 text-right font-medium">{count}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs text-text-muted">{label}</span>
      <select
        className="border border-border-soft bg-white px-2 py-1.5 text-sm w-full mt-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
