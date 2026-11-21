import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { repo } from "@/data/repo";
import { duplicateProject } from "@/data/projects";
import { STATUS_LABELS, type ProjectRecord, type ProjectStatus } from "@/data/types";
import { analyze } from "@/engine";
import { money } from "@/engine/format";
import { boxesFor, IsoView } from "@/blueprint/iso";
import { DifficultyChip, Empty, PageHeader } from "@/components/ui";

export default function Projects() {
  const nav = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [filter, setFilter] = useState<ProjectStatus | "all">("all");
  const reload = () => repo.listProjects().then(setProjects);
  useEffect(() => {
    reload();
  }, []);

  const shown = projects.filter((p) => filter === "all" || p.status === filter);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader title="My projects" subtitle={`${projects.length} saved project${projects.length === 1 ? "" : "s"}`} actions={<Link to="/create" className="btn-primary">New project</Link>} />
      <div className="mb-4 flex flex-wrap gap-1">
        {(["all", ...Object.keys(STATUS_LABELS)] as (ProjectStatus | "all")[]).map((s) => (
          <button key={s} className={`tab ${filter === s ? "tab-active" : ""}`} onClick={() => setFilter(s)}>
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => {
            const a = analyze(p.spec);
            return (
              <div key={p.id} className="card flex flex-col p-4">
                <Link to={`/projects/${p.id}`}>
                  <IsoView boxes={boxesFor(a)} labels={false} height={140} />
                  <div className="mt-2 font-medium">{p.name}</div>
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-charcoal-700/80">
                  <DifficultyChip d={p.spec.difficulty} />
                  <span>{STATUS_LABELS[p.status]}</span>·<span>~{money(a.estimatedCost)}</span>·<span>v{p.version}</span>
                </div>
                <div className="mt-auto flex gap-1 pt-3">
                  <Link to={`/projects/${p.id}`} className="btn-secondary px-3 py-1.5">
                    Open
                  </Link>
                  <button
                    className="btn-ghost px-3 py-1.5"
                    onClick={async () => {
                      const c = await duplicateProject(p, true);
                      nav(`/projects/${c.id}`);
                    }}
                  >
                    Create variation
                  </button>
                  <button
                    className="btn-ghost ml-auto px-3 py-1.5 text-danger-500"
                    onClick={async () => {
                      if (confirm(`Delete “${p.name}” and its history? This can't be undone.`)) {
                        await repo.deleteProject(p.id);
                        reload();
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
