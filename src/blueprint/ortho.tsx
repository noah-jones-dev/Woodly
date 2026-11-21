/**
 * Orthographic technical drawings with dimension lines.
 *
 *   front: looking at the y = 0 face → horizontal = x, vertical = z
 *   side:  looking from the right (+x) → horizontal = y (front at left), vertical = z
 *   top:   looking down → horizontal = x, vertical = y (front at bottom)
 *
 * Parts are drawn far-to-near so nearer parts cover the ones behind them.
 */
import type { Analysis } from "@/engine";
import type { CutPlan } from "@/engine/cutlist";
import type { ResolvedPart } from "@/engine/resolve";
import { materialColor } from "./iso";

export type View = "front" | "side" | "top";
type Rect = { id: string; x: number; y: number; w: number; h: number; depth: number; color: string };

function rectsFor(a: Analysis, view: View): Rect[] {
  const out: Rect[] = [];
  for (const p of a.resolved.parts)
    for (const at of p.instances) {
      const color = materialColor(p);
      if (view === "front") out.push({ id: p.id, x: at.x, y: -(at.z + p.size.z), w: p.size.x, h: p.size.z, depth: -at.y, color });
      else if (view === "side") out.push({ id: p.id, x: at.y, y: -(at.z + p.size.z), w: p.size.y, h: p.size.z, depth: at.x + p.size.x, color });
      else out.push({ id: p.id, x: at.x, y: -(at.y + p.size.y), w: p.size.x, h: p.size.y, depth: at.z + p.size.z, color });
    }
  return out.sort((r, s) => r.depth - s.depth);
}

function Dim({ x1, y1, x2, y2, text, offset, scale }: { x1: number; y1: number; x2: number; y2: number; text: string; offset: number; scale: number }) {
  const horiz = Math.abs(y1 - y2) < 1e-9;
  const ox = horiz ? 0 : offset;
  const oy = horiz ? offset : 0;
  const a = { x: x1 + ox, y: y1 + oy };
  const b = { x: x2 + ox, y: y2 + oy };
  const t = 0.9 * scale;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <g stroke="#3a3634" strokeWidth={0.06 * scale} fill="none">
      <line x1={x1} y1={y1} x2={a.x + Math.sign(ox) * t * 0.4} y2={a.y + Math.sign(oy) * t * 0.4} strokeDasharray={`${0.2 * scale}`} />
      <line x1={x2} y1={y2} x2={b.x + Math.sign(ox) * t * 0.4} y2={b.y + Math.sign(oy) * t * 0.4} strokeDasharray={`${0.2 * scale}`} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
      <text
        x={mid.x + (horiz ? 0 : -0.5 * t)}
        y={mid.y + (horiz ? -0.5 * t : 0)}
        fontSize={t * 1.25}
        textAnchor="middle"
        fill="#1e1c1b"
        stroke="#fdfbf7"
        strokeWidth={0.35 * scale}
        paintOrder="stroke"
        fontFamily="Inter, sans-serif"
        fontWeight={600}
        transform={horiz ? undefined : `rotate(-90 ${mid.x - 0.5 * t} ${mid.y})`}
      >
        {text}
      </text>
    </g>
  );
}

export function OrthoView({ analysis, view, fmt, height = 320, showLabels = true }: { analysis: Analysis; view: View; fmt: (v: number) => string; height?: number; showLabels?: boolean }) {
  const rects = rectsFor(analysis, view);
  const bb = analysis.resolved.bbox;
  const [hx, hy] = view === "front" ? ["x", "z"] : view === "side" ? ["y", "z"] : ["x", "y"];
  const W = bb.size[hx as "x"];
  const H = bb.size[hy as "x"];
  const x0 = bb.min[hx as "x"];
  const y0 = -(bb.min[hy as "x"] + H);
  const scale = Math.max(W, H) / 22;
  const pad = 5 * scale;
  const labelled = new Set<string>();

  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad * 0.6} ${W + pad * 1.6} ${H + pad * 1.6}`} style={{ height, width: "100%" }} role="img" aria-label={`${view} view`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a3634" />
        </marker>
      </defs>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} fillOpacity={0.55} stroke="#2b2826" strokeWidth={0.05 * scale} />
      ))}
      {showLabels &&
        [...rects].reverse().map((r, i) => {
          if (labelled.has(r.id) || Math.min(r.w, r.h) < 1.1 * scale) return null;
          labelled.add(r.id);
          return (
            <text key={`t${i}`} x={r.x + r.w / 2} y={r.y + r.h / 2} fontSize={0.9 * scale} textAnchor="middle" dominantBaseline="central" fill="#2b2826" fontFamily="Inter, sans-serif" fontWeight={700}>
              {r.id}
            </text>
          );
        })}
      <Dim x1={x0} y1={y0 + H} x2={x0 + W} y2={y0 + H} text={fmt(W)} offset={2.6 * scale} scale={scale} />
      <Dim x1={x0} y1={y0} x2={x0} y2={y0 + H} text={fmt(H)} offset={-2.6 * scale} scale={scale} />
    </svg>
  );
}

/** A single component drawn flat with its length, width and thickness. */
export function PartDiagram({ part, fmt, height = 140 }: { part: ResolvedPart; fmt: (v: number) => string; height?: number }) {
  const L = part.length;
  const Wd = part.width;
  const scale = Math.max(L, Wd) / 40;
  const pad = 5 * scale;
  return (
    <svg viewBox={`${-pad} ${-pad} ${L + pad * 2} ${Wd + pad * 2}`} style={{ height, width: "100%" }} role="img" aria-label={`${part.id} part diagram`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3a3634" />
        </marker>
      </defs>
      <rect x={0} y={0} width={L} height={Wd} fill={materialColor(part)} stroke="#2b2826" strokeWidth={0.1 * scale} />
      {/* grain lines */}
      {Array.from({ length: 4 }, (_, i) => (
        <path key={i} d={`M ${L * 0.08} ${(Wd * (i + 1)) / 5} Q ${L * 0.5} ${(Wd * (i + 1)) / 5 + Wd * 0.05} ${L * 0.92} ${(Wd * (i + 1)) / 5}`} stroke="#8a5a2b" strokeOpacity={0.35} strokeWidth={0.07 * scale} fill="none" />
      ))}
      <text x={L / 2} y={Wd / 2} fontSize={Math.min(Wd * 0.45, 2.2 * scale)} textAnchor="middle" dominantBaseline="central" fontWeight={700} fill="#2b2826" fontFamily="Inter, sans-serif">
        {part.id}
      </text>
      <Dim x1={0} y1={Wd} x2={L} y2={Wd} text={fmt(L)} offset={2.5 * scale} scale={scale} />
      <Dim x1={L} y1={0} x2={L} y2={Wd} text={fmt(Wd)} offset={2.5 * scale} scale={scale} />
    </svg>
  );
}

/** Board and sheet cutting layouts from the optimizer. Lengths are inches. */
export function CutDiagrams({ plan, fmtIn }: { plan: CutPlan; fmtIn: (inches: number) => string }) {
  return (
    <div className="space-y-4">
      {plan.boards.map((b, i) => (
        <div key={`b${i}`} className="print-avoid-break">
          <div className="mb-1 text-xs font-medium text-charcoal-700">
            Board {i + 1}: {b.stock.name} × {fmtIn(b.boardLength)}
          </div>
          <svg viewBox={`0 0 ${b.boardLength} ${b.stock.width}`} style={{ width: "100%", height: Math.max(28, Math.min(70, 900 * (b.stock.width / b.boardLength))) }} preserveAspectRatio="none">
            <rect x={0} y={0} width={b.boardLength} height={b.stock.width} fill="#efe6d6" stroke="#2b2826" strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
            {b.pieces.map((p, j) => (
              <g key={j}>
                <rect x={p.offset} y={0} width={p.length} height={p.width} fill="#d9b48a" stroke="#6b4320" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </g>
            ))}
          </svg>
          <div className="relative mt-0.5 flex text-[10px] text-charcoal-700">
            {b.pieces.map((p, j) => (
              <span key={j} style={{ position: "absolute", left: `${(p.offset / b.boardLength) * 100}%`, width: `${(p.length / b.boardLength) * 100}%` }} className="truncate text-center">
                {p.label} · {fmtIn(p.length)}
              </span>
            ))}
          </div>
          <div className="h-4" />
        </div>
      ))}
      {plan.sheets.map((s, i) => (
        <div key={`s${i}`} className="print-avoid-break">
          <div className="mb-1 text-xs font-medium text-charcoal-700">
            Sheet {i + 1}: {s.stock.name.replace(/ \(4x8\)/, "")} — {s.panel.name} — {Math.round(s.utilization * 100)}% used
          </div>
          <svg viewBox={`-1 -1 ${s.panel.length + 2} ${s.panel.width + 2}`} style={{ width: "100%", maxWidth: (560 * s.panel.length) / 96 }}>
            <rect x={0} y={0} width={s.panel.length} height={s.panel.width} fill="#efe6d6" stroke="#2b2826" strokeWidth={0.3} />
            {s.placements.map((p, j) => (
              <g key={j}>
                <rect x={p.x} y={p.y} width={p.length} height={p.width} fill="#e9d2a6" stroke="#6b4320" strokeWidth={0.3} />
                <text x={p.x + p.length / 2} y={p.y + p.width / 2} fontSize={Math.min(3, p.width / 3)} textAnchor="middle" dominantBaseline="central" fill="#2b2826" fontFamily="Inter, sans-serif" fontWeight={600}>
                  {p.label} {fmtIn(p.length)}×{fmtIn(p.width)}
                  {p.rotated ? " ↻" : ""}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}
