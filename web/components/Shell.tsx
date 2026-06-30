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
      {/* 사이드바 */}
      <aside className="w-64 shrink-0 bg-navy border-r border-border-soft bg-[#0A2147] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight">SKMR</div>
          <div className="text-xs text-white/60 mt-0.5">Skill Portal</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {SECTIONS.map((section) => {
            const items = nav.filter((i) => i.section === section);
            if (!items.length) return null;
            return (
              <div key={section} className="mb-4">
                <div className="px-5 py-1 text-[11px] uppercase tracking-wider text-white/40">
                  {section}
                </div>
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={`block px-5 py-2 text-sm border-l-2 ${
                        active
                          ? "border-sk-orange bg-white/10 text-white font-medium"
                          : "border-transparent text-white/75 hover:bg-white/5"
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
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-white/40">
          prototype · Next.js
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-bg-surface border-b border-border-soft flex items-center justify-between px-6">
          <div className="text-sm text-text-muted">SK머티리얼즈 · Skill 관리 시스템</div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">역할</span>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as PersonaCode)}
              className="border border-border-soft bg-white px-2 py-1 text-sm text-text-main"
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
