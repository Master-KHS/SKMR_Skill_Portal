import type { ReactNode } from "react";

export function PageHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5 border border-border-soft bg-bg-main/70 px-6 py-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-text-main">{title}</h1>
      {desc && <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{desc}</p>}
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
        <div className="border-b border-border-soft bg-bg-main/60 px-4 py-3 text-[15px] font-extrabold tracking-wide text-text-main">
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

export function Badge({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`inline-block border px-2 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{label}</span>;
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
    <div className={`bg-bg-surface border border-border-soft border-t-[3px] p-4 ${accent ? "border-t-sk-red" : "border-t-text-main/70"}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold text-text-main">{value}</div>
    </div>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`bg-sk-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-50 hover:brightness-95 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
