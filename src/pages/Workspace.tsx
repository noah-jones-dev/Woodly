import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProject } from "@/state/useProject";
import { STATUS_LABELS, type ProjectStatus } from "@/data/types";
import { DifficultyChip, Spinner, StatusBadge } from "@/components/ui";
import { BlueprintsTab, CutListTab, InstructionsTab, MaterialsTab, NotesTab, OverviewTab, ToolsTab } from "@/components/workspace/Tabs";
import { AssistantPanel, ParametersPanel, ValidationPanel } from "@/components/workspace/SidePanels";

// Three.js is large; load it only when the 3D tab is opened.
const Model3D = lazy(() => import("@/blueprint/Model3D").then((m) => ({ default: m.Model3D })));

const TABS = ["Overview", "Blueprints", "3D Model", "Cut List", "Materials", "Tools", "Instructions", "Notes"] as const;
type Tab = (typeof TABS)[number];

export default function Workspace() {
  const { id } = useParams();
  const { project, analysis, patch, saveSpec } = useProject(id);
  const [tab, setTab] = useState<Tab>("Overview");
  const [focusStep, setFocusStep] = useState<number>();
  const [right, setRight] = useState<"design" | "checks" | "assistant">("design");

  if (project === undefined) return <div className="p-8"><Spinner /></div>;
  if (project === null || !analysis) return <div className="p-8">Project not found. <Link to="/projects" className="underline">Back to projects</Link></div>;

  const toggleStep = (i: number) =>
    patch((p) => {
      const completedSteps = p.completedSteps.includes(i) ? p.completedSteps.filter((x) => x !== i) : [...p.completedSteps, i];
      const status: ProjectStatus = completedSteps.length === p.spec.steps.length ? "completed" : completedSteps.length ? "in-progress" : p.status;
      return { completedSteps, status };
    });

  const issues = analysis.validation.issues.filter((i) => i.severity !== "info").length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-cream-200 bg-cream-50 px-6 py-3">
        <Link to="/projects" className="text-sm text-charcoal-700/70 hover:underline">
          ← Projects
        </Link>
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <DifficultyChip d={project.spec.difficulty} />
        <StatusBadge report={analysis.validation} />
        <select className="input w-auto py-1 text-xs" value={project.status} onChange={(e) => patch(() => ({ status: e.target.value as ProjectStatus }))}>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Link to={`/projects/${project.id}/manual`} className="btn-secondary">
            Manual / PDF
          </Link>
          <Link to={`/projects/${project.id}/build`} className="btn-primary">
            ▶ Build Mode
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_320px]">
        {/* Left: navigation + assembly steps */}
        <aside className="overflow-auto border-r border-cream-200 bg-cream-50/60 p-3">
          <div className="label px-2 pb-1">Project</div>
          {TABS.map((t) => (
            <button key={t} className={`tab block w-full text-left ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          <div className="label mt-5 px-2 pb-1">
            Assembly steps · {project.completedSteps.length}/{project.spec.steps.length}
          </div>
          {project.spec.steps.map((s, i) => (
            <button
              key={i}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-cream-200"
              onClick={() => {
                setTab("Instructions");
                setFocusStep(i);
              }}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${project.completedSteps.includes(i) ? "bg-sage-500 text-cream-50" : "bg-cream-200"}`}>
                {project.completedSteps.includes(i) ? "✓" : i + 1}
              </span>
              <span className="leading-snug">{s.title}</span>
            </button>
          ))}
        </aside>

        {/* Center: the selected view */}
        <section className="min-w-0 overflow-auto p-6">
          {tab === "Overview" && <OverviewTab project={project} analysis={analysis} onRestore={(v) => saveSpec(v.spec, `Restored v${v.version}`)} />}
          {tab === "Blueprints" && <BlueprintsTab project={project} analysis={analysis} />}
          {tab === "3D Model" && (
            <Suspense fallback={<Spinner />}>
              <Model3D analysis={analysis} />
            </Suspense>
          )}
          {tab === "Cut List" && <CutListTab project={project} analysis={analysis} />}
          {tab === "Materials" && <MaterialsTab project={project} analysis={analysis} onPurchased={(purchased) => patch(() => ({ purchased }))} onSpec={saveSpec} />}
          {tab === "Tools" && <ToolsTab project={project} analysis={analysis} />}
          {tab === "Instructions" && <InstructionsTab project={project} analysis={analysis} onToggleStep={toggleStep} focus={focusStep} />}
          {tab === "Notes" && <NotesTab project={project} analysis={analysis} onNotes={(notes) => patch(() => ({ notes }))} onPhotos={(photos) => patch(() => ({ photos }))} />}
        </section>

        {/* Right: design studio, checks, assistant */}
        <aside className="flex min-h-0 flex-col border-l border-cream-200 bg-cream-50/60">
          <div className="flex gap-1 border-b border-cream-200 p-2">
            {(
              [
                ["design", "Design"],
                ["checks", `Checks${issues ? ` (${issues})` : ""}`],
                ["assistant", "Assistant"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={`tab flex-1 px-2 text-xs ${right === k ? "tab-active" : ""}`} onClick={() => setRight(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {right === "design" && <ParametersPanel spec={project.spec} onChange={saveSpec} />}
            {right === "checks" && <ValidationPanel analysis={analysis} />}
            {right === "assistant" && <AssistantPanel project={project} analysis={analysis} onChat={(chat) => patch(() => ({ chat }))} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
