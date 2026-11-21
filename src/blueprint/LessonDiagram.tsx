/** Small illustrations for lessons, drawn with the same isometric renderer. */
import type { Lesson } from "@/content/lessons";
import { IsoView, type IsoBox } from "./iso";

const W = "#e2c290";
const D = "#c99a62";
const box = (key: string, at: [number, number, number], size: [number, number, number], color = W, mode: IsoBox["mode"] = "normal"): IsoBox => ({
  key, partId: key, label: key, at: { x: at[0], y: at[1], z: at[2] }, size: { x: size[0], y: size[1], z: size[2] }, color, mode,
});

const SCENES: Partial<Record<NonNullable<Lesson["diagram"]>, IsoBox[]>> = {
  butt: [box("A", [0, 0, 0], [0.75, 6, 8]), box("B", [0.75, 0, 0], [10, 6, 0.75], D)],
  pocket: [box("A", [0, 0, 0], [0.75, 4, 10]), box("B", [0.75, 0, 4], [10, 4, 0.75], D, "highlight")],
  dado: [box("A", [0, 0, 0], [0.75, 8, 2]), box("A2", [0, 0, 2.75], [0.75, 8, 5]), box("A3", [0, 0, 2], [0.375, 8, 0.75]), box("B", [0.375, 0, 2], [10, 8, 0.75], D, "highlight")],
  rabbet: [box("A", [0, 0, 0], [0.75, 8, 10]), box("A2", [0.75, 0.25, 0], [0.75, 7.75, 10]), box("B", [0.75, 0, 0], [0.75, 0.25, 10], D, "highlight")],
  mortise: [box("Leg", [0, 0, 0], [3, 3, 12], D), box("Tenon", [3, 1, 7], [1.5, 1, 3], W, "highlight"), box("Rail", [4.5, 0.5, 6], [8, 2, 5])],
  dovetail: [box("A", [0, 0, 0], [0.75, 6, 6]), box("T1", [0.75, 0, 0], [0.75, 6, 1.5], D, "highlight"), box("T2", [0.75, 0, 3], [0.75, 6, 1.5], D, "highlight"), box("B", [1.5, 0, 0], [8, 6, 6], D)],
  dowel: [box("A", [0, 0, 0], [6, 0.75, 4]), box("P1", [6, 0.2, 1], [1.5, 0.375, 0.375], "#a8743f", "highlight"), box("P2", [6, 0.2, 2.6], [1.5, 0.375, 0.375], "#a8743f", "highlight"), box("B", [7.5, 0, 0], [6, 0.75, 4], D)],
};

export function LessonDiagram({ kind }: { kind: NonNullable<Lesson["diagram"]> }) {
  const scene = SCENES[kind];
  if (scene) return <IsoView boxes={scene} height={220} labels={false} />;
  if (kind === "grain")
    return (
      <svg viewBox="0 0 300 120" className="h-44 w-full">
        <rect x="10" y="20" width="230" height="60" fill={W} stroke="#2b2826" />
        {[30, 40, 50, 60, 70].map((y) => <path key={y} d={`M10 ${y} Q 125 ${y + 6} 240 ${y}`} stroke="#8a5a2b" fill="none" opacity="0.5" />)}
        <ellipse cx="260" cy="50" rx="18" ry="30" fill={D} stroke="#2b2826" />
        {[6, 12, 18].map((r) => <ellipse key={r} cx="260" cy="50" rx={r * 0.6} ry={r} stroke="#6b4320" fill="none" opacity="0.6" />)}
        <text x="125" y="105" textAnchor="middle" fontSize="11">long grain (strong)</text>
        <text x="260" y="100" textAnchor="middle" fontSize="11">end grain</text>
      </svg>
    );
  if (kind === "rip-cross")
    return (
      <svg viewBox="0 0 300 120" className="h-44 w-full">
        <rect x="20" y="30" width="260" height="50" fill={W} stroke="#2b2826" />
        <line x1="150" y1="20" x2="150" y2="90" stroke="#b8463a" strokeWidth="2" strokeDasharray="5 3" />
        <line x1="10" y1="55" x2="290" y2="55" stroke="#6f8a6a" strokeWidth="2" strokeDasharray="5 3" />
        <text x="150" y="105" textAnchor="middle" fontSize="11" fill="#b8463a">crosscut (across grain)</text>
        <text x="80" y="20" textAnchor="middle" fontSize="11" fill="#6f8a6a">rip cut (with grain)</text>
      </svg>
    );
  if (kind === "miter-bevel")
    return (
      <svg viewBox="0 0 300 120" className="h-44 w-full">
        <polygon points="20,30 120,30 140,80 20,80" fill={W} stroke="#2b2826" />
        <text x="75" y="100" textAnchor="middle" fontSize="11">miter (angled across face)</text>
        <polygon points="170,40 270,40 270,70 190,70" fill={D} stroke="#2b2826" />
        <text x="220" y="100" textAnchor="middle" fontSize="11">bevel (angled through thickness)</text>
      </svg>
    );
  // square
  return (
    <svg viewBox="0 0 300 140" className="h-44 w-full">
      <rect x="60" y="20" width="180" height="100" fill="none" stroke="#2b2826" strokeWidth="6" />
      <line x1="60" y1="20" x2="240" y2="120" stroke="#6f8a6a" strokeDasharray="6 4" strokeWidth="2" />
      <line x1="240" y1="20" x2="60" y2="120" stroke="#6f8a6a" strokeDasharray="6 4" strokeWidth="2" />
      <text x="150" y="136" textAnchor="middle" fontSize="11">equal diagonals = square</text>
    </svg>
  );
}
