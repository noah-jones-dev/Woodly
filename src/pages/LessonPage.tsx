import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LESSON_BY_KEY, LESSONS } from "@/content/lessons";
import { toolName } from "@/content/tools";
import { repo } from "@/data/repo";
import type { LessonProgress, ProjectRecord } from "@/data/types";
import { LessonDiagram } from "@/blueprint/LessonDiagram";
import { Callout, DifficultyChip } from "@/components/ui";

export default function LessonPage() {
  const { key } = useParams();
  const lesson = key ? LESSON_BY_KEY[key] : undefined;
  const [prog, setProg] = useState<LessonProgress>();
  const [usedIn, setUsedIn] = useState<{ p: ProjectRecord; step: number }[]>([]);

  useEffect(() => {
    if (!lesson) return;
    repo.getProgress().then(async (all) => {
      const cur = all.find((x) => x.lessonKey === lesson.key);
      const next: LessonProgress = cur?.status === "completed" ? { ...cur, updatedAt: new Date().toISOString() } : { lessonKey: lesson.key, status: "in-progress", progress: 50, updatedAt: new Date().toISOString() };
      setProg(next);
      await repo.saveProgress(next);
    });
    // Explain techniques in the context of the user's own projects.
    repo.listProjects().then((ps) => setUsedIn(ps.flatMap((p) => p.spec.steps.map((s, i) => ({ p, step: i, s })).filter((x) => x.s.techniques.includes(lesson.key)).map(({ p, step }) => ({ p, step })))));
  }, [lesson]);

  if (!lesson) return <div className="p-8">Lesson not found.</div>;
  const idx = LESSONS.indexOf(lesson);
  const nextLesson = LESSONS[idx + 1];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/learn" className="text-sm text-charcoal-700/70 hover:underline">
        ← All lessons
      </Link>
      <h1 className="mt-2 text-3xl font-semibold">{lesson.title}</h1>
      <div className="mt-2 flex items-center gap-2 text-sm text-charcoal-700/70">
        <DifficultyChip d={lesson.level} /> {lesson.minutes} min read
      </div>
      <p className="mt-4 text-lg text-charcoal-700">{lesson.summary}</p>
      {lesson.diagram && (
        <div className="card my-6 p-4">
          <LessonDiagram kind={lesson.diagram} />
        </div>
      )}
      <div className="prose-woodly mt-6">
        {lesson.sections.map((s) => (
          <div key={s.heading} className="mb-5">
            <h2 className="mb-2 text-xl font-semibold">{s.heading}</h2>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      {lesson.tools.length > 0 && (
        <div className="mb-4">
          <div className="label mb-1">Tools</div>
          <div className="flex flex-wrap gap-1">
            {lesson.tools.map((t) => <span key={t} className="chip bg-cream-200">{toolName(t)}</span>)}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {lesson.mistakes.length > 0 && <Callout tone="info" title="Common mistakes"><ul className="list-disc pl-4">{lesson.mistakes.map((m) => <li key={m}>{m}</li>)}</ul></Callout>}
        {lesson.safety.length > 0 && <Callout tone="warn" title="Safety"><ul className="list-disc pl-4">{lesson.safety.map((m) => <li key={m}>{m}</li>)}</ul></Callout>}
      </div>
      <div className="mt-4"><Callout tone="tip" title="Practice exercise">{lesson.exercise}</Callout></div>
      {usedIn.length > 0 && (
        <div className="mt-6">
          <div className="label mb-1">Where you'll use this</div>
          <ul className="text-sm">
            {usedIn.map(({ p, step }) => (
              <li key={`${p.id}-${step}`}>
                <Link className="text-wood-700 underline" to={`/projects/${p.id}`}>{p.name}</Link> — step {step + 1}: {p.spec.steps[step].title}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex items-center justify-between">
        <button
          className="btn-primary"
          disabled={prog?.status === "completed"}
          onClick={async () => {
            const p: LessonProgress = { lessonKey: lesson.key, status: "completed", progress: 100, updatedAt: new Date().toISOString() };
            setProg(p);
            await repo.saveProgress(p);
          }}
        >
          {prog?.status === "completed" ? "✓ Completed" : "Mark as complete"}
        </button>
        {nextLesson && <Link to={`/learn/${nextLesson.key}`} className="btn-ghost">Next: {nextLesson.title} →</Link>}
      </div>
    </div>
  );
}
