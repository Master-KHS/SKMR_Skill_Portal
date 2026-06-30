// 공용 UI 프리미티브 — 각진(라운드 없음) 디자인. SK Red 브랜드 + Orange 액션.
// 상태는 색+텍스트 라벨을 항상 함께.
import type { ReactNode } from "react";

export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1.5 bg-sk-red inline-block" />
        <h1 className="text-xl font-extrabold tracking-tight text-text-main">{title}</h1>
      </div>
      {desc && <p className="text-sm text-text-muted mt-1.5 ml-4">{desc}</p>}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-bg-surface border border-border-soft ${className}`}>
      {title && (
        <div className="px-4 py-2.5 border-b border-border-soft bg-bg-main/60 text-[13px] font-bold text-text-main uppercase tracking-wide">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger" | "orange" | "neutral";

const TONE: Record<Tone, string> = {
  info: "border-info text-info bg-info/[0.06]",
  success: "border-success text-success bg-success/[0.06]",
  warning: "border-warning text-[#9A6500] bg-warning/[0.08]",
  danger: "border-sk-red text-sk-red bg-sk-red/[0.06]",
  orange: "border-sk-orange text-[#C45E00] bg-sk-orange/[0.08]",
  neutral: "border-border-soft text-text-muted bg-white",
};

// 색만으로 상태 전달 금지 — label 텍스트 필수.
export function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-block border px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}>
      {label}
    </span>
  );
}

export function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-bg-surface border border-border-soft border-t-[3px] p-4 ${
        accent ? "border-t-sk-red" : "border-t-text-main/70"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-text-main mt-1.5">{value}</div>
    </div>
  );
}

// 주요 실행 버튼 — Orange
export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-sk-orange text-white px-5 py-2 text-sm font-bold disabled:opacity-50 hover:brightness-95 ${
        props.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}
