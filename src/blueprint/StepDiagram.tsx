import type { Analysis } from "@/engine";
import { boxesFor, IsoView } from "./iso";

/** Parts installed before step `index` and in it. */
export function stepParts(a: Analysis, index: number) {
  const before = new Set<string>();
  a.resolved.spec.steps.slice(0, index).forEach((s) => s.components.forEach((c) => before.add(c)));
  const current = new Set(a.resolved.spec.steps[index]?.components ?? []);
  return { before, current };
}

/**
 * IKEA-style step illustration: parts already built are shown normally,
 * parts added in this step are highlighted, future parts are hidden.
 * Steps that add nothing (cutting, finishing) show the build so far — or,
 * before anything is assembled, an exploded "all parts" view.
 */
export function StepDiagram({ analysis, index, height = 300 }: { analysis: Analysis; index: number; height?: number }) {
  const { before, current } = stepParts(analysis, index);
  if (!current.size && !before.size) return <IsoView boxes={boxesFor(analysis, { explode: 0.6 })} height={height} />;
  const visible = new Set([...before, ...current]);
  if (!current.size) return <IsoView boxes={boxesFor(analysis, { visible })} height={height} labels={false} />;
  return <IsoView boxes={boxesFor(analysis, { visible, highlight: current })} height={height} />;
}
