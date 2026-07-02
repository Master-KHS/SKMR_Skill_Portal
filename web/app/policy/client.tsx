"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, PageHeader } from "@/components/ui";

interface CriteriaRow {
  sub_family_id: string;
  sub_family_name: string;
  family_id: string;
  family_name: string;
  level: number;
  expertise_criteria: string;
  impact_criteria: string;
}

interface FamilyRow {
  family_id: string;
  family_name: string;
  description: string | null;
}

interface SubFamilyRow {
  sub_family_id: string;
  sub_family_name: string;
  description: string | null;
  family_id: string;
  family_name: string;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "L1 Youngling",
  2: "L2 Padawan",
  3: "L3 Jedi Knight",
  4: "L4 Jedi Master",
};

export function PolicyClient() {
  const [criteriaRows, setCriteriaRows] = useState<CriteriaRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [subFamilies, setSubFamilies] = useState<SubFamilyRow[]>([]);
  const [criteriaEdits, setCriteriaEdits] = useState<
    Record<string, { expertise_criteria: string; impact_criteria: string }>
  >({});
  const [familyEdits, setFamilyEdits] = useState<Record<string, { family_name: string; description: string }>>(
    {}
  );
  const [subFamilyEdits, setSubFamilyEdits] = useState<
    Record<string, { sub_family_name: string; description: string; family_id: string }>
  >({});
  const [newFamily, setNewFamily] = useState({ family_id: "", family_name: "", description: "" });
  const [newSubFamily, setNewSubFamily] = useState({
    sub_family_id: "",
    sub_family_name: "",
    family_id: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const criteriaKey = (row: CriteriaRow) => `${row.sub_family_id}|${row.level}`;

  const load = useCallback(async () => {
    const res = await fetch("/api/policy");
    const data = await res.json();
    setCriteriaRows(data.rows ?? []);
    setFamilies(data.families ?? []);
    setSubFamilies(data.subFamilies ?? []);
    setCriteriaEdits({});
    setFamilyEdits({});
    setSubFamilyEdits({});
    setMsg(null);
    setNewSubFamily((prev) => ({
      ...prev,
      family_id: (data.families?.[0]?.family_id as string | undefined) ?? "",
    }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, CriteriaRow[]>();
    for (const row of criteriaRows) {
      const key = `${row.family_id}__${row.sub_family_id}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(row);
    }
    return [...map.entries()];
  }, [criteriaRows]);

  function setCriteriaField(
    row: CriteriaRow,
    field: "expertise_criteria" | "impact_criteria",
    value: string
  ) {
    const key = criteriaKey(row);
    setCriteriaEdits((prev) => ({
      ...prev,
      [key]: {
        expertise_criteria:
          field === "expertise_criteria" ? value : prev[key]?.expertise_criteria ?? row.expertise_criteria,
        impact_criteria: field === "impact_criteria" ? value : prev[key]?.impact_criteria ?? row.impact_criteria,
      },
    }));
  }

  function setFamilyField(row: FamilyRow, field: "family_name" | "description", value: string) {
    setFamilyEdits((prev) => ({
      ...prev,
      [row.family_id]: {
        family_name: field === "family_name" ? value : prev[row.family_id]?.family_name ?? row.family_name,
        description: field === "description" ? value : prev[row.family_id]?.description ?? row.description ?? "",
      },
    }));
  }

  function setSubFamilyField(
    row: SubFamilyRow,
    field: "sub_family_name" | "description" | "family_id",
    value: string
  ) {
    setSubFamilyEdits((prev) => ({
      ...prev,
      [row.sub_family_id]: {
        sub_family_name:
          field === "sub_family_name" ? value : prev[row.sub_family_id]?.sub_family_name ?? row.sub_family_name,
        description:
          field === "description" ? value : prev[row.sub_family_id]?.description ?? row.description ?? "",
        family_id: field === "family_id" ? value : prev[row.sub_family_id]?.family_id ?? row.family_id,
      },
    }));
  }

  async function post(body: unknown) {
    const res = await fetch("/api/policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Request failed");
    }
    setCriteriaRows(data.rows ?? []);
    setFamilies(data.families ?? []);
    setSubFamilies(data.subFamilies ?? []);
    setCriteriaEdits({});
    setFamilyEdits({});
    setSubFamilyEdits({});
    return data;
  }

  async function saveAll() {
    const updates = Object.entries(criteriaEdits).map(([key, value]) => {
      const [sub_family_id, level] = key.split("|");
      return { sub_family_id, level: Number(level), ...value };
    });
    const familyUpdates = Object.entries(familyEdits).map(([family_id, value]) => ({
      family_id,
      family_name: value.family_name,
      description: value.description,
    }));
    const subFamilyUpdates = Object.entries(subFamilyEdits).map(([sub_family_id, value]) => ({
      sub_family_id,
      sub_family_name: value.sub_family_name,
      description: value.description,
      family_id: value.family_id,
    }));

    if (!updates.length && !familyUpdates.length && !subFamilyUpdates.length) return;

    setSaving(true);
    setMsg(null);
    try {
      const data = await post({
        action: "save",
        updates,
        family_updates: familyUpdates,
        sub_family_updates: subFamilyUpdates,
      });
      setMsg(`Saved ${data.saved ? "changes" : "data"} successfully.`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function createFamily() {
    if (!newFamily.family_id.trim() || !newFamily.family_name.trim()) {
      setMsg("Family ID and name are required.");
      return;
    }
    setSaving(true);
    try {
      await post({ action: "create_family", ...newFamily });
      setNewFamily({ family_id: "", family_name: "", description: "" });
      setMsg("Family created.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to create family.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFamily(familyId: string) {
    setSaving(true);
    try {
      await post({ action: "delete_family", family_id: familyId });
      setMsg(`Deleted family ${familyId}.`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to delete family.");
    } finally {
      setSaving(false);
    }
  }

  async function createSubFamily() {
    if (!newSubFamily.sub_family_id.trim() || !newSubFamily.sub_family_name.trim() || !newSubFamily.family_id) {
      setMsg("Sub-family ID, name, and family are required.");
      return;
    }
    setSaving(true);
    try {
      await post({ action: "create_sub_family", ...newSubFamily });
      setNewSubFamily({
        sub_family_id: "",
        sub_family_name: "",
        family_id: families[0]?.family_id ?? "",
        description: "",
      });
      setMsg("Sub-family created.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to create sub-family.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubFamily(subFamilyId: string) {
    setSaving(true);
    try {
      await post({ action: "delete_sub_family", sub_family_id: subFamilyId });
      setMsg(`Deleted sub-family ${subFamilyId}.`);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Failed to delete sub-family.");
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount =
    Object.keys(criteriaEdits).length + Object.keys(familyEdits).length + Object.keys(subFamilyEdits).length;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="운영 정책 관리"
        desc="Family, Sub-family, Level 체계, Level Criteria를 원본 기준으로 관리합니다."
      />

      <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 bg-bg-main py-2">
        {dirtyCount > 0 && <Badge tone="orange" label={`변경 ${dirtyCount}건`} />}
        <button
          className="ml-auto bg-sk-orange px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
          onClick={saveAll}
          disabled={saving || dirtyCount === 0}
        >
          {saving ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>

      {msg && (
        <div className="mb-4 border border-success bg-success/[0.06] p-2 text-sm text-success">{msg}</div>
      )}

      <Card title="Family" className="mb-4">
        <div className="mb-4 grid grid-cols-[120px_1fr_1fr_120px] gap-2">
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="ID"
            value={newFamily.family_id}
            onChange={(event) => setNewFamily((prev) => ({ ...prev, family_id: event.target.value }))}
          />
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="Family name"
            value={newFamily.family_name}
            onChange={(event) => setNewFamily((prev) => ({ ...prev, family_name: event.target.value }))}
          />
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="Description"
            value={newFamily.description}
            onChange={(event) => setNewFamily((prev) => ({ ...prev, description: event.target.value }))}
          />
          <button
            className="bg-sk-orange px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
            onClick={createFamily}
            disabled={saving}
          >
            추가
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="w-24 py-2 pr-3">ID</th>
              <th className="w-56 py-2 pr-3">이름</th>
              <th className="py-2 pr-3">설명</th>
              <th className="w-20 py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {families.map((family) => {
              const edit = familyEdits[family.family_id];
              const changed = family.family_id in familyEdits;
              return (
                <tr key={family.family_id} className="border-b border-border-soft align-top">
                  <td className="py-2 pr-3 font-semibold">{family.family_id}</td>
                  <td className="py-2 pr-3">
                    <input
                      className={`w-full border px-2 py-1 text-sm ${
                        changed ? "border-sk-orange" : "border-border-soft"
                      }`}
                      value={edit?.family_name ?? family.family_name}
                      onChange={(event) => setFamilyField(family, "family_name", event.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className={`w-full border px-2 py-1 text-sm ${
                        changed ? "border-sk-orange" : "border-border-soft"
                      }`}
                      value={edit?.description ?? family.description ?? ""}
                      onChange={(event) => setFamilyField(family, "description", event.target.value)}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      className="border border-sk-red px-2 py-1 text-xs font-semibold text-sk-red disabled:opacity-40"
                      onClick={() => deleteFamily(family.family_id)}
                      disabled={saving}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Sub-family" className="mb-4">
        <div className="mb-4 grid grid-cols-[140px_1fr_180px_1fr_120px] gap-2">
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="Sub-family ID"
            value={newSubFamily.sub_family_id}
            onChange={(event) => setNewSubFamily((prev) => ({ ...prev, sub_family_id: event.target.value }))}
          />
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="Sub-family name"
            value={newSubFamily.sub_family_name}
            onChange={(event) => setNewSubFamily((prev) => ({ ...prev, sub_family_name: event.target.value }))}
          />
          <select
            className="border border-border-soft px-2 py-1 text-sm"
            value={newSubFamily.family_id}
            onChange={(event) => setNewSubFamily((prev) => ({ ...prev, family_id: event.target.value }))}
          >
            {families.map((family) => (
              <option key={family.family_id} value={family.family_id}>
                {family.family_id} - {family.family_name}
              </option>
            ))}
          </select>
          <input
            className="border border-border-soft px-2 py-1 text-sm"
            placeholder="Description"
            value={newSubFamily.description}
            onChange={(event) => setNewSubFamily((prev) => ({ ...prev, description: event.target.value }))}
          />
          <button
            className="bg-sk-orange px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
            onClick={createSubFamily}
            disabled={saving || families.length === 0}
          >
            추가
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="w-28 py-2 pr-3">ID</th>
              <th className="py-2 pr-3">이름</th>
              <th className="w-40 py-2 pr-3">Family</th>
              <th className="py-2 pr-3">설명</th>
              <th className="w-20 py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {subFamilies.map((subFamily) => {
              const edit = subFamilyEdits[subFamily.sub_family_id];
              const changed = subFamily.sub_family_id in subFamilyEdits;
              return (
                <tr key={subFamily.sub_family_id} className="border-b border-border-soft align-top">
                  <td className="py-2 pr-3 font-semibold">{subFamily.sub_family_id}</td>
                  <td className="py-2 pr-3">
                    <input
                      className={`w-full border px-2 py-1 text-sm ${
                        changed ? "border-sk-orange" : "border-border-soft"
                      }`}
                      value={edit?.sub_family_name ?? subFamily.sub_family_name}
                      onChange={(event) => setSubFamilyField(subFamily, "sub_family_name", event.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className={`w-full border px-2 py-1 text-sm ${
                        changed ? "border-sk-orange" : "border-border-soft"
                      }`}
                      value={edit?.family_id ?? subFamily.family_id}
                      onChange={(event) => setSubFamilyField(subFamily, "family_id", event.target.value)}
                    >
                      {families.map((family) => (
                        <option key={family.family_id} value={family.family_id}>
                          {family.family_id} - {family.family_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className={`w-full border px-2 py-1 text-sm ${
                        changed ? "border-sk-orange" : "border-border-soft"
                      }`}
                      value={edit?.description ?? subFamily.description ?? ""}
                      onChange={(event) => setSubFamilyField(subFamily, "description", event.target.value)}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      className="border border-sk-red px-2 py-1 text-xs font-semibold text-sk-red disabled:opacity-40"
                      onClick={() => deleteSubFamily(subFamily.sub_family_id)}
                      disabled={saving}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Level 체계" className="mb-4">
        <div className="mb-3 text-sm text-text-muted">
          현재 Level은 L1-L4 고정입니다. 이 화면에서는 이름과 기준만 관리하고, 단계 수 변경은 별도 작업 범위입니다.
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border-soft text-left text-text-muted">
              <th className="w-20 py-2 pr-3">Level</th>
              <th className="py-2">이름</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(LEVEL_NAMES).map(([level, name]) => (
              <tr key={level} className="border-b border-border-soft">
                <td className="py-2 pr-3 font-semibold">L{level}</td>
                <td className="py-2">{name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Level Criteria">
        {groups.map(([groupKey, items]) => (
          <div key={groupKey} className="mb-6 last:mb-0">
            <div className="mb-2 text-xs text-text-muted">
              {items[0].family_name} / {items[0].sub_family_name}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border-soft text-left text-text-muted">
                  <th className="w-32 py-2 pr-3 align-top">Level</th>
                  <th className="py-2 pr-3 align-top">전문성 기준</th>
                  <th className="py-2 align-top">영향력 기준</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .sort((a, b) => a.level - b.level)
                  .map((row) => {
                    const key = criteriaKey(row);
                    const edit = criteriaEdits[key];
                    const changed = key in criteriaEdits;
                    return (
                      <tr key={key} className="border-b border-border-soft align-top">
                        <td className="py-2 pr-3 font-semibold">{LEVEL_NAMES[row.level]}</td>
                        <td className="py-2 pr-3">
                          <textarea
                            className={`min-h-[3rem] w-full resize-y border px-2 py-1 text-sm ${
                              changed ? "border-sk-orange" : "border-border-soft"
                            }`}
                            value={edit?.expertise_criteria ?? row.expertise_criteria}
                            onChange={(event) =>
                              setCriteriaField(row, "expertise_criteria", event.target.value)
                            }
                          />
                        </td>
                        <td className="py-2">
                          <textarea
                            className={`min-h-[3rem] w-full resize-y border px-2 py-1 text-sm ${
                              changed ? "border-sk-orange" : "border-border-soft"
                            }`}
                            value={edit?.impact_criteria ?? row.impact_criteria}
                            onChange={(event) =>
                              setCriteriaField(row, "impact_criteria", event.target.value)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
      </Card>
    </div>
  );
}
