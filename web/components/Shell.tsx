"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePersona } from "./PersonaContext";
import { visibleNav, SECTIONS, PERSONA_LABELS } from "@/lib/nav";
import type { PersonaCode } from "@/lib/types";

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
  const { persona, setPersona } = usePersona();
  const pathname = usePathname();
  const nav = visibleNav(persona);

  return (
    <div className="flex min-h-screen">
      {/* 사이드바 — 흰색 베이스 + SK Red 브랜드 */}
      <aside className="w-64 shrink-0 bg-white border-r border-border-soft flex flex-col">
        <div className="px-5 py-4 border-b-2 border-sk-red flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center bg-sk-red text-white text-sm font-black tracking-tight">
            SK
          </span>
          <div>
            <div className="text-[15px] font-extrabold tracking-tight text-text-main leading-none">
              Skill Portal
            </div>
            <div className="text-[11px] text-text-muted mt-1">SK머티리얼즈</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {SECTIONS.map((section) => {
            const items = nav.filter((i) => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="mb-4">
                <div className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
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
          prototype · <span className="text-sk-red font-bold">BUILD R10 (2026-07-01)</span>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-border-soft flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-3 w-1 bg-sk-red inline-block" />
            <span className="text-text-muted">Skill 관리 시스템</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-muted text-xs">역할</span>
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
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
