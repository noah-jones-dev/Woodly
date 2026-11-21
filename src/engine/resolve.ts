/**
 * Resolve a spec into concrete numbers: evaluate every expression, look up
 * stock, and derive each part's thickness/width/length.
 *
 * This is pure and deterministic: same spec + same overrides → same output.
 * That's what makes every dimension "traceable and reproducible".
 */
import { buildScope, evaluate, ExprError } from "./expr";
import type { Component, Expr, ProjectSpec } from "./spec";
import { STOCK, type Stock } from "./materials";

export type Vec3 = { x: number; y: number; z: number };
export type Axis = "x" | "y" | "z";

export type ResolvedPart = {
  id: string;
  name: string;
  materialId: string;
  stock: Stock | undefined;
  /** Display name for material incl. species override. */
  materialName: string;
  size: Vec3;
  instances: Vec3[];
  grain: Axis;
  /** Part dims in spec units: thickness ≤ width, length along grain. */
  thickness: number;
  width: number;
  length: number;
  thicknessAxis: Axis;
  source: Component;
};

export type ResolveIssue = { where: string; message: string };

export type ResolvedProject = {
  spec: ProjectSpec;
  scope: Record<string, number>;
  /** Multiply spec units by this to get inches. */
  toInches: number;
  parts: ResolvedPart[];
  bbox: { min: Vec3; max: Vec3; size: Vec3 };
  issues: ResolveIssue[];
};

export function resolveProject(spec: ProjectSpec, overrides: Record<string, number> = {}): ResolvedProject {
  const issues: ResolveIssue[] = [];
  let scope: Record<string, number> = {};
  try {
    scope = buildScope(spec.parameters, spec.derived, overrides);
  } catch (e) {
    issues.push({ where: "derived values", message: (e as Error).message });
  }
  const toInches = spec.units === "mm" ? 1 / 25.4 : 1;

  const ev = (e: Expr, where: string): number => {
    try {
      return evaluate(e, scope);
    } catch (err) {
      issues.push({ where, message: err instanceof ExprError ? err.message : String(err) });
      return 0;
    }
  };

  const parts: ResolvedPart[] = spec.components.map((c) => {
    const size = { x: ev(c.size.x, `${c.id} size.x`), y: ev(c.size.y, `${c.id} size.y`), z: ev(c.size.z, `${c.id} size.z`) };
    let instances: Vec3[];
    if (c.repeat) {
      if (c.positions.length !== 1) issues.push({ where: `${c.id} repeat`, message: "a repeated component must have exactly one position" });
      const n = Math.max(0, Math.round(ev(c.repeat.count, `${c.id} repeat count`)));
      const outer = scope;
      instances = [];
      for (let i = 0; i < Math.min(n, 500); i++) {
        scope = { ...outer, [c.repeat.var]: i };
        const p = c.positions[0];
        instances.push({ x: ev(p.x, `${c.id} position.x`), y: ev(p.y, `${c.id} position.y`), z: ev(p.z, `${c.id} position.z`) });
      }
      scope = outer;
    } else {
      instances = c.positions.map((p, i) => ({
        x: ev(p.x, `${c.id} position ${i + 1}.x`),
        y: ev(p.y, `${c.id} position ${i + 1}.y`),
        z: ev(p.z, `${c.id} position ${i + 1}.z`),
      }));
    }
    const pm = spec.materials.find((m) => m.id === c.material);
    const stock = pm ? STOCK[pm.stock] : undefined;
    const { thickness, width, length, thicknessAxis } = partDims(size, c.grain, stock ? stock.thickness / toInches : undefined);
    return {
      id: c.id,
      name: c.name,
      materialId: c.material,
      stock,
      materialName: pm ? (pm.species ? `${pm.species} — ${stock?.name ?? pm.stock}` : stock?.name ?? pm.stock) : c.material,
      size,
      instances,
      grain: c.grain,
      thickness,
      width,
      length,
      thicknessAxis,
      source: c,
    };
  });

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of parts)
    for (const at of p.instances)
      for (const a of ["x", "y", "z"] as const) {
        min[a] = Math.min(min[a], at[a]);
        max[a] = Math.max(max[a], at[a] + p.size[a]);
      }
  if (!parts.length) for (const a of ["x", "y", "z"] as const) (min[a] = 0), (max[a] = 0);
  const bbox = { min, max, size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z } };

  return { spec, scope, toInches, parts, bbox, issues };
}

/**
 * Length runs along the grain axis. Of the two remaining axes, the one that
 * matches the stock thickness is "thickness"; otherwise the smaller one.
 */
function partDims(size: Vec3, grain: Axis, stockThickness?: number) {
  const others = (["x", "y", "z"] as const).filter((a) => a !== grain);
  let tAxis: Axis = size[others[0]] <= size[others[1]] ? others[0] : others[1];
  if (stockThickness !== undefined) {
    const match = others.find((a) => Math.abs(size[a] - stockThickness) < 0.01 * Math.max(1, stockThickness));
    if (match) tAxis = match;
  }
  const wAxis = others.find((a) => a !== tAxis)!;
  return { thickness: size[tAxis], width: size[wAxis], length: size[grain], thicknessAxis: tAxis };
}

export const partQuantity = (p: ResolvedPart) => p.instances.length;
