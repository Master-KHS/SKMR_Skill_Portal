// 공용 UI 프리미티브 — 각진(라운드 없음) 디자인. 상태는 색+텍스트 라벨을 항상 함께.
import type { ReactNode } from "react";

export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-6 border-b border-border-soft pb-3">
      <h1 className="text-xl font-bold text-text-main">{title}</h1>
      {desc && <p className="text-sm text-text-muted mt-1">{desc}</p>}
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
        <div className="px-4 py-2.5 border-b border-border-soft text-sm font-semibold text-text-main">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger" | "orange" | "neutral";

const TONE: Record<Tone, string> = {
  info: "border-info text-info",
  success: "border-success text-success",
  warning: "border-warning text-[#9A6500]",
  danger: "border-sk-red text-sk-red",
  orange: "border-sk-orange text-[#C45E00]",
  neutral: "border-border-soft text-text-muted",
};

// 색만으로 상태 전달 금지 — label 텍스트 필수.
export function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-medium bg-white ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-bg-surface border border-border-soft p-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-text-main mt-1">{value}</div>
    </div>
  );
}
