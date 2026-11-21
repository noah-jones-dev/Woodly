import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_LABELS, LESSONS, type LessonCategory } from "@/content/lessons";
import { repo } from "@/data/repo";
import type { LessonProgress } from "@/data/types";
import { DifficultyChip, PageHeader } from "@/components/ui";
import { useApp } from "@/state/store";

const LEVEL_ORDER = ["complete-beginner", "beginner", "intermediate", "advanced"];

export default function Learn() {
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const level = useApp((s) => s.settings.profile.experience);
  useEffect(() => {
    repo.getProgress().then(setProgress);
  }, []);
  const status = (k: string) => progress.find((p) => p.lessonKey === k)?.status ?? "not-started";
  const done = progress.filter((p) => p.status === "completed").length;
  // Learning path: lessons at or just above your level that you haven't finished.
  const next = LESSONS.filter((l) => status(l.key) !== "completed" && LEVEL_ORDER.indexOf(l.level) <= LEVEL_ORDER.indexOf(level) + 1).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader title="Learn woodworking" subtitle={`${done} of ${LESSONS.length} lessons completed`} />
      {next.length > 0 && (
        <div className="card mb-8 p-5">
          <div className="label">Your learning path</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {next.map((l) => (
              <Link key={l.key} to={`/learn/${l.key}`} className="rounded-xl bg-wood-600/10 p-3 hover:bg-wood-600/20">
                <div className="font-medium">{l.title}</div>
                <div className="text-xs text-charcoal-700/70">{l.minutes} min</div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {(Object.keys(CATEGORY_LABELS) as LessonCategory[]).map((cat) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LESSONS.filter((l) => l.category === cat).map((l) => (
              <Link key={l.key} to={`/learn/${l.key}`} className="card p-4 hover:border-wood-300">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{l.title}</div>
                  {status(l.key) === "completed" && <span className="chip bg-sage-500/15 text-sage-500">✓</span>}
                </div>
                <p className="mt-1 text-sm text-charcoal-700/80">{l.summary}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-charcoal-700/70">
                  <DifficultyChip d={l.level} /> {l.minutes} min
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
