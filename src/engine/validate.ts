/**
 * Validation layer.
 *
 * AI-written specs are *proposals*. Before anything is shown as buildable,
 * these deterministic checks run on the resolved geometry:
 *
 *   - expressions evaluate; sizes are positive
 *   - parts match real stock thickness / width / length
 *   - parts don't pass through each other (unless a joint like a dado says so)
 *   - every part is connected to the rest of the build (nothing floating)
 *   - declared joints actually touch
 *   - instructions place every part exactly once, in a buildable order
 *   - hardware & tools referenced by steps exist
 *   - stability (tip-over) and shelf-sag heuristics
 *   - regulated/high-risk work is flagged for a professional
 *
 * Structural checks are heuristics, labelled as unverified estimates.
 */
import { evaluate } from "./expr";
import type { CutPlan } from "./cutlist";
import type { ResolvedPart, ResolvedProject, Vec3 } from "./resolve";
import type { JointType } from "./spec";
import { TOOL_LIBRARY } from "../content/tools";

export type Severity = "error" | "warning" | "info";
export type ValidationIssue = { severity: Severity; code: string; message: string; parts?: string[] };
export type ValidationStatus = "ok" | "review" | "blocked";
export type ValidationReport = { status: ValidationStatus; issues: ValidationIssue[] };

const INTERLOCKING: JointType[] = ["dado", "rabbet", "mortise-tenon", "dowel", "biscuit"];

const REGULATED = [
  { re: /\b(electric|wiring|outlet|circuit|light fixture|breaker)\b/i, msg: "Electrical work: follow local code; use a licensed electrician for new circuits or wiring." },
  { re: /\b(plumb|pipe|drain|water line|faucet|toilet)\b/i, msg: "Plumbing work: shut off water and consider a licensed plumber; permits may be required." },
  { re: /\b(load[- ]bearing|wall removal|remove (a|the) wall|beam|joist|header)\b/i, msg: "Structural work: consult a structural engineer or licensed contractor before modifying framing." },
  { re: /\b(deck|loft|bunk bed|stair|railing|treehouse|swing|playground)\b/i, msg: "Holds people above the ground: local codes and professionally rated hardware apply. Have the design reviewed." },
  { re: /\b(gas|furnace|chimney|fireplace)\b/i, msg: "Gas / combustion appliances: this requires a licensed professional." },
];

export function validateProject(p: ResolvedProject, plan: CutPlan): ValidationReport {
  const issues: ValidationIssue[] = [];
  const add = (severity: Severity, code: string, message: string, parts?: string[]) =>
    issues.push({ severity, code, message, parts });
  const tol = 0.02 / p.toInches; // ~1/50" in spec units
  const spec = p.spec;
  const ids = new Set(spec.components.map((c) => c.id));

  // 1. Expressions and basic geometry -------------------------------------
  for (const iss of p.issues) add("error", "expr", `${iss.where}: ${iss.message}`);
  const dupIds = spec.components.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupIds.length) add("error", "dup-id", `Duplicate component ids: ${[...new Set(dupIds)].join(", ")}`, dupIds);

  for (const part of p.parts) {
    if (part.size.x <= 0 || part.size.y <= 0 || part.size.z <= 0)
      add("error", "size", `${part.id} ${part.name} has a zero or negative dimension.`, [part.id]);
    if (!spec.materials.find((m) => m.id === part.materialId))
      add("error", "material", `${part.id} uses undefined material "${part.materialId}".`, [part.id]);
    else if (!part.stock) add("error", "stock", `${part.id}'s material is not in the stock library.`, [part.id]);
    else {
      const stockT = part.stock.thickness / p.toInches;
      if (Math.abs(part.thickness - stockT) > tol)
        add("error", "thickness", `${part.id} ${part.name} is ${round(part.thickness)} thick, but ${part.stock.name} is ${round(stockT)} thick.`, [part.id]);
      if (part.stock.kind === "board" && part.width > part.stock.width / p.toInches + tol)
        add("error", "width", `${part.id} ${part.name} is wider than a ${part.stock.nominal} board. Use wider stock, plywood, or a glued-up panel.`, [part.id]);
    }
  }
  for (const u of plan.unplaceable) add("error", "stock-size", u.reason, [u.partId]);
  if (plan.sheets.some((s) => s.placements.some((x) => x.rotated)))
    add("info", "grain", "Some sheet parts are rotated 90° on the sheet, so their grain runs the other way.");

  // 2. Interference & connectivity -----------------------------------------
  const inst = p.parts.flatMap((part) => part.instances.map((at, i) => ({ part, i, at })));
  const jointPairs = new Map<string, JointType>();
  for (const j of spec.joints) {
    for (const id of [j.a, j.b]) if (!ids.has(id)) add("error", "joint-ref", `A joint references unknown component "${id}".`);
    jointPairs.set(pairKey(j.a, j.b), j.type);
    if (j.hardware && !spec.hardware.find((h) => h.id === j.hardware))
      add("warning", "joint-hw", `Joint ${j.a}–${j.b} uses hardware "${j.hardware}" that isn't in the hardware list.`, [j.a, j.b]);
  }

  const parent = inst.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => (parent[find(a)] = find(b));
  const touchingPairs = new Set<string>();
  const reportedClash = new Set<string>();

  for (let a = 0; a < inst.length; a++)
    for (let b = a + 1; b < inst.length; b++) {
      const A = inst[a];
      const B = inst[b];
      const rel = relation(A.at, A.part.size, B.at, B.part.size, tol);
      if (rel === "none") continue;
      union(a, b);
      touchingPairs.add(pairKey(A.part.id, B.part.id));
      if (rel === "overlap") {
        const k = pairKey(A.part.id, B.part.id);
        const jt = jointPairs.get(k);
        if ((!jt || !INTERLOCKING.includes(jt)) && !reportedClash.has(k)) {
          reportedClash.add(k);
          add("error", "interference", `${A.part.id} and ${B.part.id} occupy the same space. Check their positions or declare a dado/rabbet joint.`, [A.part.id, B.part.id]);
        }
      }
    }

  const groups = new Map<number, number[]>();
  inst.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  if (groups.size > 1) {
    const sorted = [...groups.values()].sort((x, y) => y.length - x.length);
    const floating = [...new Set(sorted.slice(1).flat().map((i) => inst[i].part.id))];
    add("error", "floating", `Parts not connected to the main assembly: ${floating.join(", ")}.`, floating);
  }
  for (const j of spec.joints)
    if (ids.has(j.a) && ids.has(j.b) && !touchingPairs.has(pairKey(j.a, j.b)))
      add("warning", "joint-gap", `Joint ${j.a}–${j.b} is declared, but those parts don't touch.`, [j.a, j.b]);

  // 3. Instructions --------------------------------------------------------
  const placed = new Map<string, number>();
  const hwIds = new Set(spec.hardware.map((h) => h.id));
  const specTools = new Set(spec.tools.map((t) => t.tool));
  spec.steps.forEach((s, si) => {
    for (const id of s.components) {
      if (!ids.has(id)) add("error", "step-ref", `Step ${si + 1} references unknown component "${id}".`);
      else if (placed.has(id)) add("warning", "step-dup", `${id} is placed in step ${placed.get(id)! + 1} and again in step ${si + 1}.`, [id]);
      else placed.set(id, si);
    }
    for (const h of s.hardware) {
      if (!hwIds.has(h.id)) add("error", "step-hw", `Step ${si + 1} uses unknown hardware "${h.id}".`);
      try {
        evaluate(h.quantity, p.scope);
      } catch (e) {
        add("error", "expr", `Step ${si + 1} hardware quantity: ${(e as Error).message}`);
      }
    }
    for (const t of s.tools) {
      if (!TOOL_LIBRARY[t]) add("info", "tool-unknown", `Step ${si + 1} uses "${t}", which isn't in Woodly's tool library.`);
      if (!specTools.has(t)) add("warning", "tool-missing", `Step ${si + 1} needs "${t}" but it's not in the project's tool list.`);
    }
  });
  const unplaced = spec.components.map((c) => c.id).filter((id) => !placed.has(id));
  if (unplaced.length) add("warning", "step-missing", `No instruction step installs: ${unplaced.join(", ")}.`, unplaced);

  // Assembly order: each later step must attach to something already built.
  const builtBefore = new Set<string>();
  spec.steps.forEach((s, si) => {
    const fresh = s.components.filter((id) => ids.has(id));
    if (fresh.length && builtBefore.size) {
      const attaches = fresh.some((id) => [...builtBefore].some((b) => touchingPairs.has(pairKey(id, b))));
      if (!attaches) add("warning", "order", `Step ${si + 1} adds ${fresh.join(", ")}, but nothing it touches has been built yet.`, fresh);
    }
    fresh.forEach((id) => builtBefore.add(id));
  });
  for (const h of spec.hardware)
    try {
      evaluate(h.quantity, p.scope);
    } catch (e) {
      add("error", "expr", `Hardware ${h.id} quantity: ${(e as Error).message}`);
    }

  // 4. Structural heuristics ----------------------------------------------
  const H = p.bbox.size.z;
  const groundParts = p.parts.filter((x) => x.instances.some((at) => Math.abs(at.z - p.bbox.min.z) < tol));
  const wallMounted = p.bbox.min.z > tol || /wall[- ]mount|floating|hangs on/i.test(spec.assumptions.join(" ") + spec.summary);
  if (!wallMounted && groundParts.length) {
    const fp = footprint(groundParts);
    const ratio = H / Math.max(1e-6, Math.min(fp.x, fp.y));
    if (ratio > 3)
      add("warning", "tip", `Tall and narrow (height is ${ratio.toFixed(1)}× the base depth). Anchor it to a wall stud with an anti-tip kit.`);
  }
  if (wallMounted)
    add("info", "wall", "Wall-mounted: fasten into studs or rated anchors. Weight capacity depends on your wall and hardware and has not been verified.");

  for (const part of p.parts) {
    if (part.thicknessAxis !== "z" || !part.stock) continue;
    const spanIn = part.length * p.toInches;
    const limit = sagLimit(part);
    if (spanIn > limit) {
      const shelfy = /shelf/i.test(part.name);
      add(
        shelfy ? "warning" : "info",
        "sag",
        `${part.id} ${part.name} spans ${Math.round(spanIn)}" — over the ~${limit}" rule of thumb for ${part.stock.name}. It may sag under heavy loads; add a center support or a front stiffener. (Unverified estimate.)`,
        [part.id],
      );
    }
  }

  // 5. Regulated work ------------------------------------------------------
  const text = `${spec.name} ${spec.summary}`;
  for (const r of REGULATED) if (r.re.test(text)) add("warning", "regulated", r.msg);
  for (const f of spec.riskFlags) add("warning", "risk", f);

  const status: ValidationStatus = issues.some((i) => i.severity === "error")
    ? "blocked"
    : issues.some((i) => i.severity === "warning")
      ? "review"
      : "ok";
  return { status, issues };
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const round = (v: number) => Math.round(v * 1000) / 1000;

/** "overlap": interiors intersect; "touch": share a face; "none". */
function relation(a: Vec3, as: Vec3, b: Vec3, bs: Vec3, tol: number): "overlap" | "touch" | "none" {
  let positive = 0;
  let touching = 0;
  for (const ax of ["x", "y", "z"] as const) {
    const ov = Math.min(a[ax] + as[ax], b[ax] + bs[ax]) - Math.max(a[ax], b[ax]);
    if (ov < -tol) return "none";
    if (ov > tol) positive++;
    else touching++;
  }
  if (positive === 3) return "overlap";
  return positive === 2 && touching === 1 ? "touch" : "none";
}

function footprint(parts: ResolvedPart[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of parts)
    for (const at of p.instances) {
      minX = Math.min(minX, at.x);
      maxX = Math.max(maxX, at.x + p.size.x);
      minY = Math.min(minY, at.y);
      maxY = Math.max(maxY, at.y + p.size.y);
    }
  return { x: maxX - minX, y: maxY - minY };
}

/** Rule-of-thumb max unsupported span (inches) for moderate loads. */
function sagLimit(part: ResolvedPart): number {
  const s = part.stock!;
  const t = s.thickness;
  if (t >= 1.4) return 48;
  if (s.key.startsWith("mdf")) return 24;
  if (s.kind === "sheet") return t >= 0.7 ? 32 : 20;
  return s.hardwood ? 36 : 30;
}
