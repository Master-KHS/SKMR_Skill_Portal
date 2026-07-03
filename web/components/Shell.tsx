"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleNav, SECTIONS, PERSONA_LABELS } from "@/lib/nav";
import type { PersonaCode } from "@/lib/types";
import { FloatingAssistant } from "./FloatingAssistant";
import { usePersona } from "./PersonaContext";

const PERSONAS: PersonaCode[] = [
  "hr_admin",
  "hr_viewer",
  "team_leader",
  "calibration",
  "committee",
  "executive",
  "employee",
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { persona, setPersona, members, currentMember, setCurrentMemberId } = usePersona();
  const pathname = usePathname();
  const nav = visibleNav(persona);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border-soft bg-white">
        <div className="flex flex-col items-center gap-4 border-b-2 border-sk-red px-6 py-7 text-center">
          <img src="/assets/skill-logo.png" alt="Skill logo" className="h-32 w-32 shrink-0 object-contain" />
          <div>
            <div className="text-[21px] font-extrabold leading-tight tracking-tight text-text-main">
              <span className="block whitespace-nowrap">Skill 기반</span>
              <span className="block whitespace-nowrap">인재관리 Agent</span>
            </div>
            <div className="mt-1.5 text-[13px] text-text-muted">Diagnosis + AI Talent Search</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {SECTIONS.map((section) => {
            const items = nav.filter((i) => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="mb-6">
                <div className="px-6 py-2.5 text-[17px] font-extrabold uppercase tracking-[0.04em] text-text-main">{section}</div>
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center border-l-[3px] px-6 py-2.5 text-[16px] transition-colors ${
                        active
                          ? "border-sk-red bg-sk-red/[0.06] font-semibold text-sk-red"
                          : "border-transparent text-text-main hover:bg-bg-main"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border-soft px-5 py-3 text-[10px] uppercase tracking-wider text-text-muted">
          prototype <span className="font-bold text-sk-red">BUILD R12 (2026-07-01)</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border-soft bg-white px-6 py-3">
          <div className="flex items-center justify-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-text-muted">권한</span>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as PersonaCode)}
                className="border border-border-soft bg-white px-2.5 py-1.5 text-sm text-text-main focus:border-sk-red focus:outline-none"
              >
                {PERSONAS.map((p) => (
                  <option key={p} value={p}>
                    {PERSONA_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-text-muted">사람</span>
              {members.length === 0 ? (
                <span className="border border-warning px-2 py-1.5 text-xs text-warning">매핑된 인원 없음</span>
              ) : persona === "team_leader" ? (
                <div className="flex max-w-[760px] items-center gap-1.5 overflow-x-auto">
                  {members.map((m) => {
                    const active = currentMember?.employee_id === m.employee_id;
                    return (
                      <button
                        key={m.employee_id}
                        className={`shrink-0 border px-2.5 py-1.5 text-xs font-semibold ${
                          active
                            ? "border-sk-red bg-sk-red/[0.06] text-sk-red"
                            : "border-border-soft bg-white text-text-muted hover:text-text-main"
                        }`}
                        onClick={() => setCurrentMemberId(m.employee_id)}
                        title={`${m.name} (${m.team ?? m.division ?? "-"} · ${m.role_level ?? "-"})`}
                      >
                        {m.name}
                        <span className="ml-1 font-normal">· {m.team ?? m.division ?? "-"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <select
                    value={currentMember?.employee_id ?? ""}
                    onChange={(e) => setCurrentMemberId(e.target.value)}
                    className="min-w-56 border border-border-soft bg-white px-2.5 py-1.5 text-sm text-text-main focus:border-sk-red focus:outline-none"
                  >
                    {members.map((m) => (
                      <option key={m.employee_id} value={m.employee_id}>
                        {m.name} ({m.team ?? m.division} · {m.role_level})
                      </option>
                    ))}
                  </select>
                  <span className="border border-border-soft bg-bg-main px-2 py-1.5 text-xs text-text-muted">{members.length}명</span>
                </div>
              )}
            </label>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <FloatingAssistant />
    </div>
  );
}
