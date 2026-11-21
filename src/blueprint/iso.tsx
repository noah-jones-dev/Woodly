/**
 * Isometric SVG renderer.
 *
 * Projection (viewer at front-right, above):
 *   u = (x + y)·cos30°        (screen right)
 *   v = (x − y)·sin30° − z    (screen down)
 * y is negated relative to the textbook formula so the FRONT face (y = 0)
 * faces the viewer.
 *
 * Boxes are drawn back-to-front (painter's algorithm): we sort by a depth
 * key and draw the three faces a viewer can see — top, front and right.
 */
import type { Analysis } from "@/engine";
import type { ResolvedPart, Vec3 } from "@/engine/resolve";

const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;
export const project = (p: Vec3) => ({ u: (p.x + p.y) * C30, v: (p.x - p.y) * S30 - p.z });

export function materialColor(part: ResolvedPart): string {
  const k = part.stock?.key ?? "";
  if (k.startsWith("oak")) return "#c99a62";
  if (k.startsWith("poplar")) return "#d9cf9f";
  if (k.startsWith("spf")) return "#e3c48e";
  if (k.startsWith("ply")) return "#e9d2a6";
  if (k.startsWith("mdf")) return "#bba98d";
  if (k.startsWith("osb")) return "#c9a465";
  return "#e2c290";
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

export type IsoBox = {
  key: string;
  partId: string;
  label: string;
  at: Vec3;
  size: Vec3;
  color: string;
  mode: "normal" | "highlight" | "ghost";
};

export function boxesFor(a: Analysis, opts: { explode?: number; visible?: Set<string>; highlight?: Set<string>; ghost?: Set<string> } = {}): IsoBox[] {
  const { min, max } = a.resolved.bbox;
  const C = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const e = opts.explode ?? 0;
  const out: IsoBox[] = [];
  for (const part of a.resolved.parts) {
    if (opts.visible && !opts.visible.has(part.id)) continue;
    part.instances.forEach((at, i) => {
      const c = { x: at.x + part.size.x / 2, y: at.y + part.size.y / 2, z: at.z + part.size.z / 2 };
      const off = { x: (c.x - C.x) * e, y: (c.y - C.y) * e, z: (c.z - C.z) * e * 1.3 };
      out.push({
        key: `${part.id}.${i}`,
        partId: part.id,
        label: part.id,
        at: { x: at.x + off.x, y: at.y + off.y, z: at.z + off.z },
        size: part.size,
        color: materialColor(part),
        mode: opts.highlight?.has(part.id) ? "highlight" : opts.ghost?.has(part.id) ? "ghost" : "normal",
      });
    });
  }
  // Painter's order: farthest first. Viewer direction ≈ (+x, −y, +z).
  return out.sort((p, q) => depth(p) - depth(q));
}
const depth = (b: IsoBox) => b.at.x + b.size.x / 2 - (b.at.y + b.size.y / 2) + (b.at.z + b.size.z / 2) * 0.9;

function faces(b: IsoBox) {
  const { x, y, z } = b.at;
  const { x: w, y: d, z: h } = b.size;
  const P = (px: number, py: number, pz: number) => project({ x: px, y: py, z: pz });
  return {
    top: [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)],
    front: [P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)],
    right: [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)],
  };
}

const pts = (ps: { u: number; v: number }[]) => ps.map((p) => `${p.u.toFixed(2)},${p.v.toFixed(2)}`).join(" ");

export function IsoView({
  boxes,
  labels = true,
  className,
  height = 360,
  onSelect,
  selected,
}: {
  boxes: IsoBox[];
  labels?: boolean;
  className?: string;
  height?: number;
  onSelect?: (partId: string) => void;
  selected?: string;
}) {
  if (!boxes.length) return <svg className={className} height={height} />;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const b of boxes)
    for (const f of Object.values(faces(b)))
      for (const p of f) {
        minU = Math.min(minU, p.u);
        maxU = Math.max(maxU, p.u);
        minV = Math.min(minV, p.v);
        maxV = Math.max(maxV, p.v);
      }
  const pad = Math.max(maxU - minU, maxV - minV) * 0.08 + 2;
  const vb = `${minU - pad} ${minV - pad} ${maxU - minU + 2 * pad} ${maxV - minV + 2 * pad}`;
  const sw = (maxU - minU + maxV - minV) / 900;
  const labelled = new Set<string>();

  return (
    <svg viewBox={vb} className={className} style={{ height, width: "100%" }} role="img" aria-label="Isometric drawing">
      {boxes.map((b) => {
        const f = faces(b);
        const base = b.mode === "highlight" ? "#c8965f" : b.color;
        const op = b.mode === "ghost" ? 0.25 : 1;
        const stroke = b.mode === "highlight" ? "#6b4320" : selected === b.partId ? "#b8463a" : "#2b2826";
        const strokeW = (b.mode === "highlight" || selected === b.partId ? 2.2 : 1) * sw;
        return (
          <g key={b.key} opacity={op} onClick={onSelect ? () => onSelect(b.partId) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
            <polygon points={pts(f.front)} fill={shade(base, 0.92)} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
            <polygon points={pts(f.right)} fill={shade(base, 0.78)} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
            <polygon points={pts(f.top)} fill={shade(base, 1.06)} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
          </g>
        );
      })}
      {labels &&
        boxes
          .filter((b) => b.mode !== "ghost")
          .map((b) => {
            if (labelled.has(b.partId)) return null;
            labelled.add(b.partId);
            const c = project({ x: b.at.x + b.size.x / 2, y: b.at.y, z: b.at.z + b.size.z / 2 });
            const r = pad * 0.32;
            return (
              <g key={`l-${b.key}`} pointerEvents="none">
                <circle cx={c.u} cy={c.v} r={r} fill="#fdfbf7" stroke="#2b2826" strokeWidth={sw * 1.4} />
                <text x={c.u} y={c.v} fontSize={r * 1.05} textAnchor="middle" dominantBaseline="central" fontWeight={700} fill="#2b2826" fontFamily="Inter, sans-serif">
                  {b.label}
                </text>
              </g>
            );
          })}
    </svg>
  );
}
