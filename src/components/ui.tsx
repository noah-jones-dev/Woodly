import type { ReactNode } from "react";
import type { Difficulty } from "@/engine/spec";
import type { ValidationReport } from "@/engine/validate";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  "complete-beginner": "Complete Beginner",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function DifficultyChip({ d }: { d: Difficulty }) {
  const color = { "complete-beginner": "bg-sage-500/15 text-sage-500", beginner: "bg-sage-500/15 text-sage-500", intermediate: "bg-warn-500/15 text-warn-500", advanced: "bg-danger-500/15 text-danger-500" }[d];
  return <span className={`chip ${color}`}>{DIFFICULTY_LABEL[d]}</span>;
}

export function StatusBadge({ report }: { report: ValidationReport }) {
  const map = {
    ok: ["bg-sage-500/15 text-sage-500", "Checks passed"],
    review: ["bg-warn-500/15 text-warn-500", "Review warnings"],
    blocked: ["bg-danger-500/15 text-danger-500", "Not buildable yet"],
  } as const;
  const [cls, text] = map[report.status];
  return <span className={`chip ${cls}`}>{text}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-charcoal-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-charcoal-700/80">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-cream-200 p-8 text-center text-sm text-charcoal-700/70">{children}</div>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-wood-400 border-t-transparent" aria-label="Loading" />;
}

export function Callout({ tone, title, children }: { tone: "info" | "warn" | "danger" | "tip"; title?: string; children: ReactNode }) {
  const cls = { info: "border-cream-200 bg-cream-50", tip: "border-sage-500/30 bg-sage-500/10", warn: "border-warn-500/30 bg-warn-500/10", danger: "border-danger-500/30 bg-danger-500/10" }[tone];
  return (
    <div className={`rounded-xl border p-3 text-sm ${cls}`}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  );
}
