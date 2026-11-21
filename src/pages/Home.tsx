import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { repo } from "@/data/repo";
import { STATUS_LABELS, type LessonProgress, type ProjectRecord } from "@/data/types";
import { TEMPLATES } from "@/templates";
import { LESSONS, LESSON_BY_KEY } from "@/content/lessons";
import { analyze } from "@/engine";
import { boxesFor, IsoView } from "@/blueprint/iso";
import { DifficultyChip } from "@/components/ui";
import { useApp } from "@/state/store";
import { aiAvailable } from "@/ai";

export default function Home() {
  const nav = useNavigate();
  const settings = useApp((s) => s.settings);
  const [idea, setIdea] = useState("");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  useEffect(() => {
    repo.listProjects().then(setProjects);
    repo.getProgress().then(setProgress);
  }, []);

  const building = projects.filter((p) => p.status === "in-progress" || p.status === "ready");
  const done = progress.filter((p) => p.status === "completed").length;
  const recentLessons = [...progress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const go = () => idea.trim() && nav(`/create?idea=${encodeURIComponent(idea.trim())}`);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="card relative overflow-hidden p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-wood-300/30" />
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to your workshop.</h1>
        <p className="mt-1 text-charcoal-700/80">You don't need to know how to build something to start building it. You just need an idea.</p>
        <div className="mt-6 flex gap-3">
          <input
            className="input py-3 text-base"
            placeholder="Describe something you want to build… e.g. “a floating shelf above my desk”"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
          <button className="btn-primary px-6" onClick={go} disabled={!idea.trim()}>
            Create
          </button>
        </div>
        {!aiAvailable(settings) && (
          <p className="mt-3 text-xs text-charcoal-700/70">
            No AI provider connected — Woodly will use its built-in templates. <Link to="/settings" className="underline">Connect an AI provider</Link> to design anything.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">{building.length ? "Continue building" : "Recent projects"}</h2>
          {(building.length ? building : projects).length === 0 ? (
            <div className="card p-6 text-sm text-charcoal-700/80">No projects yet. Describe an idea above or start from one of the beginner projects below.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(building.length ? building : projects).slice(0, 4).map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="card flex gap-3 p-4 hover:border-wood-300">
                  <div className="w-24 shrink-0">
                    <IsoView boxes={boxesFor(analyze(p.spec))} labels={false} height={80} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-charcoal-700/70">{STATUS_LABELS[p.status]}</div>
                    <div className="mt-2 h-1.5 w-32 rounded-full bg-cream-200">
                      <div className="h-1.5 rounded-full bg-sage-500" style={{ width: `${(p.completedSteps.length / Math.max(1, p.spec.steps.length)) * 100}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Learning progress</h2>
          <div className="card p-4">
            <div className="text-3xl font-semibold">
              {done}
              <span className="text-base font-normal text-charcoal-700/70"> / {LESSONS.length} lessons</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-cream-200">
              <div className="h-2 rounded-full bg-wood-500" style={{ width: `${(done / LESSONS.length) * 100}%` }} />
            </div>
            <div className="mt-4 label">Recently viewed</div>
            <ul className="mt-1 space-y-1 text-sm">
              {recentLessons.length ? (
                recentLessons.map((r) => (
                  <li key={r.lessonKey}>
                    <Link className="hover:underline" to={`/learn/${r.lessonKey}`}>
                      {LESSON_BY_KEY[r.lessonKey]?.title ?? r.lessonKey}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link className="text-wood-700 hover:underline" to="/learn/shop-safety">
                    Start with Power tool safety →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recommended beginner projects</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TEMPLATES.map((t) => (
            <Link key={t.key} to={`/create?template=${t.key}`} className="card p-4 hover:border-wood-300">
              <IsoView boxes={boxesFor(analyze(t.spec))} labels={false} height={110} />
              <div className="mt-2 font-medium">{t.spec.name}</div>
              <div className="text-xs text-charcoal-700/70">{t.blurb}</div>
              <div className="mt-2">
                <DifficultyChip d={t.spec.difficulty} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
