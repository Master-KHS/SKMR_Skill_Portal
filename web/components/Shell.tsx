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
      <aside className="w-64 shrink-0 bg-white border-r border-border-soft flex flex-col">
        <div className="px-4 py-5 border-b-2 border-sk-red flex flex-col items-center gap-3 text-center">
          <img
            src="/assets/skill-logo.png"
            alt="Skill logo"
            className="h-28 w-28 shrink-0 object-contain"
          />
          <div>
            <div className="text-[17px] font-extrabold tracking-tight text-text-main leading-tight">
              <span className="block whitespace-nowrap">Skill 기반</span>
              <span className="block whitespace-nowrap">인재관리 Agent</span>
            </div>
            <div className="text-[11px] text-text-muted mt-1">Diagnosis + AI Talent Search</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {SECTIONS.map((section) => {
            const items = nav.filter((i) => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="mb-5">
                <div className="px-5 py-2 text-[14px] font-extrabold uppercase tracking-[0.04em] text-text-main">
                  {section}
                </div>
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`flex items-center px-5 py-2 text-[13px] border-l-[3px] transition-colors ${
                        active
                          ? "border-sk-red bg-sk-red/[0.06] text-sk-red font-semibold"
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

        <div className="px-5 py-3 border-t border-border-soft text-[10px] uppercase tracking-wider text-text-muted">
          prototype <span className="text-sk-red font-bold">BUILD R12 (2026-07-01)</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-border-soft flex items-center justify-between px-6">
          <div className="flex min-w-[320px] items-center gap-2 text-sm">
            <span className="h-7 w-[2px] shrink-0 bg-sk-red inline-block" />
            <span className="whitespace-nowrap text-text-muted">Skill 기반 인재관리 Agent</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-text-muted text-xs">권한</span>
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
              <span className="text-text-muted text-xs">사람</span>
              {members.length === 0 ? (
                <span className="text-xs text-warning border border-warning px-2 py-1.5">
                  매핑된 인원 없음
                </span>
              ) : persona === "team_leader" ? (
                <div className="flex max-w-[620px] items-center gap-1.5 overflow-x-auto">
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
                  <span className="border border-border-soft bg-bg-main px-2 py-1.5 text-xs text-text-muted">
                    {members.length}명
                  </span>
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
