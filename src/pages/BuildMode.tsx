import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProject } from "@/state/useProject";
import { useFormat } from "@/lib/useFormat";
import { StepDiagram } from "@/blueprint/StepDiagram";
import { StepMeta } from "@/components/workspace/Tabs";
import { Spinner } from "@/components/ui";

/** Full-screen, one-step-at-a-time building experience. ← / → keys navigate. */
export default function BuildMode() {
  const { id } = useParams();
  const { project, analysis, patch } = useProject(id);
  const [i, setI] = useState<number>();
  const { fmt } = useFormat(project?.spec);

  useEffect(() => {
    if (project && i === undefined) {
      const firstOpen = project.spec.steps.findIndex((_, n) => !project.completedSteps.includes(n));
      setI(firstOpen < 0 ? 0 : firstOpen);
    }
  }, [project, i]);

  const total = project?.spec.steps.length ?? 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(total - 1, (x ?? 0) + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, (x ?? 0) - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (!project || !analysis || i === undefined) return <div className="p-8"><Spinner /></div>;
  const step = project.spec.steps[i];
  const done = project.completedSteps.includes(i);

  const completeAndNext = async () => {
    await patch((p) => {
      const completedSteps = p.completedSteps.includes(i) ? p.completedSteps : [...p.completedSteps, i];
      return { completedSteps, status: completedSteps.length === total ? "completed" : "in-progress" };
    });
    if (i < total - 1) setI(i + 1);
  };

  return (
    <div className="flex h-full flex-col bg-cream-100">
      <header className="flex items-center gap-4 border-b border-cream-200 bg-cream-50 px-6 py-3">
        <Link to={`/projects/${project.id}`} className="btn-ghost">
          ✕ Exit
        </Link>
        <div className="font-semibold">{project.name}</div>
        <div className="flex flex-1 gap-1">
          {project.spec.steps.map((_, n) => (
            <button
              key={n}
              onClick={() => setI(n)}
              className={`h-2 flex-1 rounded-full ${n === i ? "bg-wood-600" : project.completedSteps.includes(n) ? "bg-sage-500" : "bg-cream-200"}`}
              aria-label={`Go to step ${n + 1}`}
            />
          ))}
        </div>
        <div className="text-sm text-charcoal-700/70">
          Step {i + 1} of {total}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="card flex items-center p-4">
          <StepDiagram analysis={analysis} index={i} height={560} />
        </div>
        <div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal-800 text-3xl font-semibold text-cream-50">{i + 1}</div>
            <h1 className="text-3xl font-semibold leading-tight">{step.title}</h1>
          </div>
          <p className="mt-5 text-lg leading-relaxed">{step.description}</p>
          <StepMeta spec={project.spec} analysis={analysis} index={i} fmt={fmt} large />
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-cream-200 bg-cream-50 px-8 py-4">
        <button className="btn-secondary px-6 py-3 text-base" disabled={i === 0} onClick={() => setI(i - 1)}>
          ← Previous
        </button>
        {done && <span className="text-sm text-sage-500">✓ Completed</span>}
        {i < total - 1 ? (
          <button className="btn-primary px-8 py-3 text-base" onClick={completeAndNext}>
            {done ? "Next step →" : "Done — next step →"}
          </button>
        ) : (
          <button className="btn-primary px-8 py-3 text-base" onClick={completeAndNext} disabled={done}>
            {done ? "Project complete 🎉" : "Finish project"}
          </button>
        )}
      </footer>
    </div>
  );
}
