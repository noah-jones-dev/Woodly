/**
 * Engine facade: one call turns a spec into everything the UI needs.
 *
 *   spec ──resolve──▶ geometry ──▶ cut list ──▶ cut plan ──▶ shopping list
 *                                    └──────────▶ validation report
 */
import { buildCutList, optimizeCuts, type CutListRow, type CutPlan } from "./cutlist";
import { resolveProject, type ResolvedProject } from "./resolve";
import { buildShoppingList, shoppingTotal, type ShoppingItem } from "./shopping";
import type { ProjectSpec } from "./spec";
import { validateProject, type ValidationReport } from "./validate";

export type Analysis = {
  resolved: ResolvedProject;
  cutList: CutListRow[];
  plan: CutPlan;
  shopping: ShoppingItem[];
  estimatedCost: number;
  validation: ValidationReport;
};

export function analyze(spec: ProjectSpec): Analysis {
  const resolved = resolveProject(spec);
  const cutList = buildCutList(resolved);
  const plan = optimizeCuts(resolved);
  const shopping = buildShoppingList(resolved, plan);
  const validation = validateProject(resolved, plan);
  return { resolved, cutList, plan, shopping, estimatedCost: shoppingTotal(shopping), validation };
}

/** Return a new spec with one parameter changed (clamped to its min/max). */
export function setParameter(spec: ProjectSpec, key: string, value: number): ProjectSpec {
  return {
    ...spec,
    parameters: spec.parameters.map((p) => {
      if (p.key !== key) return p;
      let v = value;
      if (p.min !== undefined) v = Math.max(p.min, v);
      if (p.max !== undefined) v = Math.min(p.max, v);
      if (p.kind === "count") v = Math.round(v);
      return { ...p, value: v };
    }),
  };
}

const DIRECTION_WORDS: Record<string, { param: RegExp; sign: 1 | -1 }> = {
  wider: { param: /width|wide|length/i, sign: 1 },
  narrower: { param: /width|wide|length/i, sign: -1 },
  longer: { param: /length|width/i, sign: 1 },
  shorter: { param: /height|tall|length/i, sign: -1 },
  taller: { param: /height|tall/i, sign: 1 },
  higher: { param: /height|tall/i, sign: 1 },
  lower: { param: /height|tall/i, sign: -1 },
  deeper: { param: /depth|deep/i, sign: 1 },
  shallower: { param: /depth|deep/i, sign: -1 },
};

/**
 * Deterministic natural-language edits, tried before asking the AI:
 *   "make it 12 inches wider", "2 inches taller", "set width to 60",
 *   "add a shelf" / "3 shelves".
 * Returns the parameter changes, or null if the request isn't understood.
 */
export function parseQuickEdit(spec: ProjectSpec, text: string): { key: string; value: number; label: string }[] | null {
  const t = text.toLowerCase();
  const toUnits = (n: number, unit?: string) => {
    if (!unit) return n;
    const inches = /^(in|inch|inches|")$/.test(unit) ? n : /^(ft|foot|feet|')$/.test(unit) ? n * 12 : /^(mm)$/.test(unit) ? n / 25.4 : /^(cm)$/.test(unit) ? n / 2.54 : n;
    return spec.units === "mm" ? inches * 25.4 : inches;
  };
  const find = (re: RegExp) => spec.parameters.find((p) => re.test(p.key) || re.test(p.label));

  // "12 inches wider"
  const rel = /(\d+(?:\.\d+)?)\s*(in|inch|inches|"|ft|foot|feet|'|mm|cm)?\s*(wider|narrower|longer|shorter|taller|higher|lower|deeper|shallower)/.exec(t);
  if (rel) {
    const dir = DIRECTION_WORDS[rel[3]];
    const p = find(dir.param);
    if (!p) return null;
    const value = p.value + dir.sign * toUnits(parseFloat(rel[1]), rel[2]);
    return [{ key: p.key, value, label: p.label }];
  }
  // "set the width to 60" / "height 30 inches"
  const abs = /(width|height|depth|length)\s*(?:to|=|of|at)?\s*(\d+(?:\.\d+)?)\s*(in|inch|inches|"|ft|foot|feet|'|mm|cm)?/.exec(t);
  if (abs) {
    const p = find(new RegExp(abs[1], "i"));
    if (!p) return null;
    return [{ key: p.key, value: toUnits(parseFloat(abs[2]), abs[3]), label: p.label }];
  }
  // shelves
  const shelves = spec.parameters.find((p) => p.kind === "count" && /shel/i.test(p.key + p.label));
  if (shelves) {
    const n = /(\d+)\s*shelves/.exec(t);
    if (n) return [{ key: shelves.key, value: parseInt(n[1], 10), label: shelves.label }];
    if (/(add|another|one more|extra) shelf/.test(t)) return [{ key: shelves.key, value: shelves.value + 1, label: shelves.label }];
    if (/(remove|one less|fewer|delete) (a )?shel/.test(t)) return [{ key: shelves.key, value: shelves.value - 1, label: shelves.label }];
  }
  return null;
}

export * from "./spec";
export type { ResolvedProject, ResolvedPart, Vec3 } from "./resolve";
export type { CutListRow, CutPlan } from "./cutlist";
export type { ShoppingItem } from "./shopping";
export type { ValidationReport, ValidationIssue } from "./validate";
