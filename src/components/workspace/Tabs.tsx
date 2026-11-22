import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Analysis } from "@/engine";
import type { ProjectSpec } from "@/engine/spec";
import { HARDWARE, STOCK } from "@/engine/materials";
import { money } from "@/engine/format";
import { KERF_IN } from "@/engine/cutlist";
import { evaluate } from "@/engine/expr";
import { repo } from "@/data/repo";
import type { ProjectRecord, ProjectVersion } from "@/data/types";
import { useFormat } from "@/lib/useFormat";
import { useApp } from "@/state/store";
import { boxesFor, IsoView } from "@/blueprint/iso";
import { CutDiagrams, OrthoView, PartDiagram } from "@/blueprint/ortho";
import { StepDiagram } from "@/blueprint/StepDiagram";
import { TOOL_LIBRARY, substituteTools, toolName } from "@/content/tools";
import { LESSON_BY_KEY } from "@/content/lessons";
import { Callout, DIFFICULTY_LABEL, DifficultyChip } from "@/components/ui";
import { fileToImage } from "@/lib/images";
import { uid } from "@/lib/platform";

type TabProps = { project: ProjectRecord; analysis: Analysis };

export function OverviewTab({ project, analysis, onRestore }: TabProps & { onRestore: (v: ProjectVersion) => void }) {
  const { fmt } = useFormat(project.spec);
  const s = project.spec;
  const b = analysis.resolved.bbox.size;
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  useEffect(() => {
    repo.listVersions(project.id).then(setVersions);
  }, [project.id, project.version]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="card p-4">
        <IsoView boxes={boxesFor(analysis)} height={380} />
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm leading-relaxed">{s.summary}</p>
          {s.style && <div className="mt-2 text-xs text-charcoal-700/70">Style: {s.style}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Overall size", `${fmt(b.x)} W × ${fmt(b.y)} D × ${fmt(b.z)} H`],
            ["Difficulty", DIFFICULTY_LABEL[s.difficulty]],
            ["Estimated time", `~${s.estimatedHours} hours`],
            ["Estimated cost", `~${money(analysis.estimatedCost)}`],
            ["Parts", `${analysis.cutList.reduce((n, r) => n + r.quantity, 0)} pieces, ${analysis.cutList.length} unique`],
            ["Leftover offcuts", `${analysis.plan.wastePercent}% of stock bought`],
          ].map(([k, v]) => (
            <div key={k} className="card p-3">
              <div className="label">{k}</div>
              <div className="mt-0.5 text-sm font-medium">{v}</div>
            </div>
          ))}
        </div>
        {s.riskFlags.length > 0 && (
          <Callout tone="danger" title="Professional guidance required">
            <ul className="list-disc pl-4">
              {s.riskFlags.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Callout>
        )}
        {s.assumptions.length > 0 && (
          <Callout tone="info" title="Design assumptions">
            <ul className="list-disc pl-4">
              {s.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Callout>
        )}
        <div>
          <div className="label mb-1">Version history</div>
          <div className="max-h-48 space-y-1 overflow-auto text-sm">
            {versions.map((v) => (
              <div key={v.version} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-cream-200">
                <span className="font-mono text-xs">v{v.version}</span>
                <span className="flex-1 truncate">{v.note}</span>
                <span className="text-xs text-charcoal-700/60">{new Date(v.createdAt).toLocaleDateString()}</span>
                {v.version !== project.version && (
                  <button className="text-xs text-wood-700 underline" onClick={() => onRestore(v)}>
                    restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-charcoal-700/60">Created from: {project.origin}</div>
      </div>
    </div>
  );
}

export function BlueprintsTab({ project, analysis }: TabProps) {
  const { fmt } = useFormat(project.spec);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {(["front", "side", "top"] as const).map((v) => (
          <div key={v} className="card p-3">
            <div className="label mb-1">{v === "front" ? "Front elevation" : v === "side" ? "Side elevation" : "Top-down view"}</div>
            <OrthoView analysis={analysis} view={v} fmt={fmt} height={260} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-3">
          <div className="label mb-1">Isometric view</div>
          <IsoView boxes={boxesFor(analysis)} height={320} />
        </div>
        <div className="card p-3">
          <div className="label mb-1">Exploded assembly view</div>
          <IsoView boxes={boxesFor(analysis, { explode: 0.55 })} height={320} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-semibold">Component diagrams</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {analysis.resolved.parts.map((p) => (
            <div key={p.id} className="card p-3">
              <div className="flex items-baseline justify-between">
                <div className="font-medium">
                  <span className="font-mono">{p.id}</span> · {p.name}
                </div>
                <div className="text-xs">×{p.instances.length}</div>
              </div>
              <PartDiagram part={p} fmt={fmt} />
              <div className="text-xs text-charcoal-700/80">
                {fmt(p.thickness)} thick · {p.materialName} · grain runs along length
              </div>
              {p.source.drilling.length > 0 && <div className="mt-1 text-xs">Drilling: {p.source.drilling.join("; ")}</div>}
              {p.source.cuts.length > 0 && <div className="mt-1 text-xs">Cuts: {p.source.cuts.join("; ")}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CutListTab({ project, analysis }: TabProps) {
  const { fmt, fmtIn } = useFormat(project.spec);
  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-charcoal-700/70">
            <tr className="border-b border-cream-200">
              {["ID", "Part", "Qty", "Thickness", "Width", "Length", "Material", "Notes"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.cutList.map((r) => (
              <tr key={r.id} className="border-b border-cream-200/60 last:border-0">
                <td className="px-3 py-2 font-mono font-semibold">{r.id}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.quantity}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{fmt(r.thickness)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {fmt(r.width)}
                  {r.needsRip && <span className="chip ml-1 bg-warn-500/15 text-warn-500">rip</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{fmt(r.length)}</td>
                <td className="px-3 py-2 text-xs">{r.material}</td>
                <td className="px-3 py-2 text-xs">{[...r.cuts, ...r.notes].join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">Optimized cutting layout</h3>
          <div className="text-xs text-charcoal-700/80">
            {analysis.plan.boards.length} boards · {analysis.plan.sheets.length} sheets · {analysis.plan.wastePercent}% waste · allows {fmtIn(KERF_IN)} saw kerf
          </div>
        </div>
        <CutDiagrams plan={analysis.plan} fmtIn={fmtIn} />
        <p className="mt-3 text-xs text-charcoal-700/70">Tip: cut the longest parts first, and re-measure after each cut — saw blades remove material.</p>
      </div>
    </div>
  );
}

export function MaterialsTab({ project, analysis, onPurchased, onSpec }: TabProps & { onPurchased: (keys: string[]) => void; onSpec: (s: ProjectSpec, note: string) => void }) {
  const items = analysis.shopping;
  const bought = new Set(project.purchased);
  const total = items.reduce((s, i) => s + i.total, 0);
  const remaining = items.filter((i) => !bought.has(i.key)).reduce((s, i) => s + i.total, 0);
  const text = items.map((i) => `[${bought.has(i.key) ? "x" : " "}] ${i.quantity} ${i.unit} — ${i.name}${i.needed ? ` (${i.needed})` : ""} — ~${money(i.total)}`).join("\n");

  const download = () => {
    const csv = ["Item,Quantity,Unit,Est. price,Used in,Purchased", ...items.map((i) => [i.name, i.quantity, i.unit, i.total, i.usedIn.join(" / "), bought.has(i.key) ? "yes" : "no"].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${project.name} shopping list.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          Estimated total <span className="font-semibold">{money(total)}</span> · remaining <span className="font-semibold">{money(remaining)}</span>
          <span className="ml-2 text-xs text-charcoal-700/60">Prices are rough estimates; check your local store.</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(text)}>
            Copy list
          </button>
          <button className="btn-secondary" onClick={download}>
            Export CSV
          </button>
        </div>
      </div>
      {(["lumber", "sheet", "hardware", "supply"] as const).map((cat) => {
        const list = items.filter((i) => i.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} className="card p-4">
            <h3 className="mb-2 font-semibold">{{ lumber: "Lumber", sheet: "Sheet goods", hardware: "Hardware", supply: "Supplies & finishes" }[cat]}</h3>
            <div className="divide-y divide-cream-200">
              {list.map((i) => (
                <label key={i.key} className="flex cursor-pointer gap-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-1 accent-sage-500"
                    checked={bought.has(i.key)}
                    onChange={() => onPurchased(bought.has(i.key) ? project.purchased.filter((k) => k !== i.key) : [...project.purchased, i.key])}
                  />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${bought.has(i.key) ? "text-charcoal-700/50 line-through" : ""}`}>
                      {i.quantity} {i.unit} · {i.name}
                    </div>
                    <div className="text-xs text-charcoal-700/70">
                      {i.needed && <>{i.needed} · </>}Used for: {i.usedIn.join(", ")}
                      {i.alternatives.length > 0 && <> · Alternatives: {i.alternatives.slice(0, 3).join(", ")}</>}
                    </div>
                  </div>
                  <div className="text-sm">{money(i.total)}</div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <MaterialSwap spec={project.spec} analysis={analysis} onSpec={onSpec} />
    </div>
  );
}

/** Swap wood species / sheet type for compatible stock (same thickness, wide enough). */
function MaterialSwap({ spec, analysis, onSpec }: { spec: ProjectSpec; analysis: Analysis; onSpec: (s: ProjectSpec, note: string) => void }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold">Change materials</h3>
      <p className="mb-3 text-xs text-charcoal-700/70">Only stock with the same thickness (and enough width) is offered, so every dimension stays valid.</p>
      <div className="space-y-2">
        {spec.materials.map((m) => {
          const cur = STOCK[m.stock];
          const parts = analysis.resolved.parts.filter((p) => p.materialId === m.id);
          const maxW = Math.max(0, ...parts.map((p) => p.width * analysis.resolved.toInches));
          const options = Object.values(STOCK).filter((s) => cur && s.kind === cur.kind && Math.abs(s.thickness - cur.thickness) < 0.01 && (s.kind === "sheet" || s.width >= maxW - 0.01));
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-40 text-charcoal-700">Parts {parts.map((p) => p.id).join(", ")}</span>
              <select
                className="input w-auto"
                value={m.stock}
                onChange={(e) => onSpec({ ...spec, materials: spec.materials.map((x) => (x.id === m.id ? { ...x, stock: e.target.value, species: undefined } : x)) }, `Material ${m.id} → ${STOCK[e.target.value]?.name}`)}
              >
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToolsTab({ project }: TabProps) {
  const { settings, update } = useApp();
  const owned = new Set(settings.profile.ownedTools);
  const missing = substituteTools(
    project.spec.tools.map((t) => t.tool),
    owned,
  );
  const toggle = (k: string) =>
    update((s) => ({ ...s, profile: { ...s.profile, ownedTools: owned.has(k) ? s.profile.ownedTools.filter((t) => t !== k) : [...s.profile.ownedTools, k] } }));
  const [open, setOpen] = useState<string>();

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <Callout tone="warn" title={`You're missing ${missing.length} tool${missing.length === 1 ? "" : "s"}`}>
          <ul className="space-y-1">
            {missing.map((m) => {
              const req = project.spec.tools.find((t) => t.tool === m.tool);
              return (
                <li key={m.tool}>
                  <span className="font-medium">{toolName(m.tool)}</span> {req?.essential ? "(essential)" : "(optional)"}
                  {m.allAlternatives.length ? (
                    <span>
                      {" "}
                      — instead:{" "}
                      {m.allAlternatives.map((a) => (
                        <span key={a.tool} className="mr-2">
                          {owned.has(a.tool) && <span className="chip mr-1 bg-sage-500/15 text-sage-500">you own</span>}
                          <b>{toolName(a.tool)}</b>: {a.how}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span> — no safe substitute; consider borrowing or renting one.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Callout>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {project.spec.tools.map((t) => {
          const info = TOOL_LIBRARY[t.tool];
          return (
            <div key={t.tool} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{toolName(t.tool)}</div>
                  <div className="text-xs text-charcoal-700/70">{t.essential ? "Essential" : "Optional"} · {t.reason}</div>
                </div>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" className="accent-sage-500" checked={owned.has(t.tool)} onChange={() => toggle(t.tool)} /> I own this
                </label>
              </div>
              {info && (
                <>
                  <p className="mt-2 text-sm">{info.description}</p>
                  <button className="mt-2 text-xs text-wood-700 underline" onClick={() => setOpen(open === t.tool ? undefined : t.tool)}>
                    {open === t.tool ? "Hide" : "How to use it safely"}
                  </button>
                  {open === t.tool && (
                    <div className="mt-2 space-y-2 text-sm">
                      <ul className="list-disc pl-5">{info.howTo.map((h) => <li key={h}>{h}</li>)}</ul>
                      {info.safety.length > 0 && (
                        <Callout tone="warn" title="Safety">
                          <ul className="list-disc pl-4">{info.safety.map((h) => <li key={h}>{h}</li>)}</ul>
                        </Callout>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InstructionsTab({ project, analysis, onToggleStep, focus }: TabProps & { onToggleStep: (i: number) => void; focus?: number }) {
  const { fmt } = useFormat(project.spec);
  useEffect(() => {
    if (focus !== undefined) document.getElementById(`step-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);
  return (
    <div className="space-y-5">
      {project.spec.steps.map((s, i) => {
        const done = project.completedSteps.includes(i);
        return (
          <div key={i} id={`step-${i}`} className={`card grid gap-4 p-5 lg:grid-cols-[1fr_1.1fr] ${done ? "opacity-70" : ""}`}>
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-800 text-lg font-semibold text-cream-50">{i + 1}</div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{s.description}</p>
              <StepMeta spec={project.spec} analysis={analysis} index={i} fmt={fmt} />
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-sage-500" checked={done} onChange={() => onToggleStep(i)} /> Step complete
              </label>
            </div>
            <div className="rounded-xl bg-cream-100 p-2">
              <StepDiagram analysis={analysis} index={i} height={280} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Components, tools, hardware, tips, warnings and lessons for one step. Shared by Build Mode and the manual. */
export function StepMeta({ spec, analysis, index, fmt, large = false }: { spec: ProjectSpec; analysis: Analysis; index: number; fmt: (v: number) => string; large?: boolean }) {
  const s = spec.steps[index];
  const text = large ? "text-base" : "text-sm";
  const parts = s.components.map((id) => analysis.cutList.find((r) => r.id === id)).filter(Boolean);
  return (
    <div className={`mt-4 space-y-3 ${text}`}>
      {parts.length > 0 && (
        <div>
          <div className="label">Components</div>
          <ul className="mt-1 space-y-0.5">
            {parts.map((r) => (
              <li key={r!.id}>
                <span className="font-mono font-semibold">{r!.id}</span> {r!.name} ×{r!.quantity} — {fmt(r!.width)} × {fmt(r!.length)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.hardware.length > 0 && (
        <div>
          <div className="label">Hardware</div>
          <ul className="mt-1">
            {s.hardware.map((h) => (
              <li key={h.id}>
                {typeof h.quantity === "number" ? h.quantity : evalQty(h.quantity, analysis)} × {hardwareName(spec, h.id)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.tools.length > 0 && (
        <div>
          <div className="label">Tools</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {s.tools.map((t) => (
              <span key={t} className="chip bg-cream-200">
                {toolName(t)}
              </span>
            ))}
          </div>
        </div>
      )}
      {s.tips.map((t) => (
        <Callout key={t} tone="tip" title="Tip">
          {t}
        </Callout>
      ))}
      {s.warnings.map((t) => (
        <Callout key={t} tone="warn" title="Warning">
          {t}
        </Callout>
      ))}
      {s.techniques.length > 0 && (
        <div className="text-xs no-print">
          Learn:{" "}
          {s.techniques.map((k) => (
            <Link key={k} to={`/learn/${k}`} className="mr-2 text-wood-700 underline">
              {LESSON_BY_KEY[k]?.title ?? k}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function hardwareName(spec: ProjectSpec, id: string) {
  const stock = spec.hardware.find((x) => x.id === id)?.stock;
  return (stock && HARDWARE[stock]?.name) ?? stock ?? id;
}

function evalQty(q: string, a: Analysis) {
  try {
    return Math.ceil(evaluate(q, a.resolved.scope));
  } catch {
    return "?";
  }
}

export function NotesTab({ project, onNotes, onPhotos }: TabProps & { onNotes: (n: string) => void; onPhotos: (p: ProjectRecord["photos"]) => void }) {
  const [notes, setNotes] = useState(project.notes);
  useEffect(() => {
    const t = setTimeout(() => notes !== project.notes && onNotes(notes), 500);
    return () => clearTimeout(t);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="label mb-1">Notes</div>
        <textarea className="input min-h-72" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Measurements you took, changes you made, what you'd do differently…" />
        <div className="mt-1 text-xs text-charcoal-700/60">Saved automatically.</div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="label">Photos of your work</div>
          <label className="btn-secondary cursor-pointer px-3 py-1.5">
            Add photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const img = await fileToImage(f);
                onPhotos([...project.photos, { id: uid(), dataUrl: img.dataUrl, caption: "", addedAt: new Date().toISOString() }]);
              }}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {project.photos.map((p) => (
            <figure key={p.id} className="card overflow-hidden">
              <img src={p.dataUrl} alt={p.caption || "Project photo"} className="h-36 w-full object-cover" />
              <figcaption className="flex items-center gap-1 p-2">
                <input className="input py-1 text-xs" value={p.caption} placeholder="Caption" onChange={(e) => onPhotos(project.photos.map((x) => (x.id === p.id ? { ...x, caption: e.target.value } : x)))} />
                <button className="text-xs text-danger-500" onClick={() => onPhotos(project.photos.filter((x) => x.id !== p.id))}>
                  ✕
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
        {!project.photos.length && <div className="text-sm text-charcoal-700/70">Photos stay on this computer. Tip: attach one in the assistant panel to ask for feedback.</div>}
      </div>
    </div>
  );
}

export { DifficultyChip };
