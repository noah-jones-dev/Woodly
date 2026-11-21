/**
 * Interactive 3D preview (React Three Fiber).
 *
 * Woodly is z-up (z = height); Three.js is y-up. We map
 *   woodly (x, y, z) → three (x, z, −y)
 * so the front of the project (y = 0) faces the default camera.
 *
 * The model is generated from the same resolved geometry as the drawings,
 * so it always matches the cut list.
 */
import { Canvas } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import type { Analysis } from "@/engine";
import { boxesFor } from "./iso";

export function Model3D({ analysis, height = 460 }: { analysis: Analysis; height?: number }) {
  const [explode, setExplode] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | undefined>();
  const parts = analysis.resolved.parts;
  const visible = useMemo(() => new Set(parts.map((p) => p.id).filter((id) => !hidden.has(id))), [parts, hidden]);
  const boxes = useMemo(() => boxesFor(analysis, { explode, visible }), [analysis, explode, visible]);
  const { min, max, size } = analysis.resolved.bbox;
  const center: [number, number, number] = [(min.x + max.x) / 2, (min.z + max.z) / 2, -(min.y + max.y) / 2];
  const r = Math.max(size.x, size.y, size.z) * (1 + explode);
  const sel = parts.find((p) => p.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <div className="relative overflow-hidden rounded-2xl border border-cream-200 bg-gradient-to-b from-cream-50 to-cream-200" style={{ height }}>
        {/* flat = no tone mapping, so wood colors match the drawings */}
        <Canvas flat shadows camera={{ position: [center[0] + r * 1.5, center[1] + r * 1.0, center[2] + r * 2.0], fov: 35, near: 0.1, far: r * 50 }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[r, r * 2, r]} intensity={1.1} castShadow />
          <directionalLight position={[-r, r, -r]} intensity={0.3} />
          {boxes.map((b) => (
            <mesh
              key={b.key}
              position={[b.at.x + b.size.x / 2, b.at.z + b.size.z / 2, -(b.at.y + b.size.y / 2)]}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                setSelected(b.partId === selected ? undefined : b.partId);
              }}
            >
              <boxGeometry args={[b.size.x, b.size.z, b.size.y]} />
              <meshStandardMaterial color={b.partId === selected ? "#c8965f" : b.color} roughness={0.8} />
              <Edges color={b.partId === selected ? "#6b4320" : "#5a4a3a"} />
            </mesh>
          ))}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center[0], min.z - 0.01 - (explode ? size.z * explode * 0.65 : 0), center[2]]} receiveShadow>
            <planeGeometry args={[r * 6, r * 6]} />
            <shadowMaterial opacity={0.15} />
          </mesh>
          <OrbitControls target={center} makeDefault />
        </Canvas>
        <div className="absolute bottom-3 left-3 rounded-lg bg-cream-50/90 px-3 py-1 text-xs text-charcoal-700 no-print">Drag to rotate · scroll to zoom · click a part</div>
      </div>
      <div className="space-y-4">
        <div>
          <div className="label mb-1">Exploded view</div>
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(parseFloat(e.target.value))} className="w-full accent-wood-600" />
        </div>
        {sel && (
          <div className="card p-3 text-sm">
            <div className="font-semibold">
              {sel.id} · {sel.name}
            </div>
            <div className="text-charcoal-700/80">{sel.materialName}</div>
            <div className="mt-1 text-xs">Qty {sel.instances.length}</div>
          </div>
        )}
        <div>
          <div className="label mb-1">Components</div>
          <div className="max-h-72 space-y-1 overflow-auto pr-1">
            {parts.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-cream-200">
                <input
                  type="checkbox"
                  className="accent-wood-600"
                  checked={!hidden.has(p.id)}
                  onChange={() =>
                    setHidden((h) => {
                      const n = new Set(h);
                      n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                      return n;
                    })
                  }
                />
                <span className="font-mono text-xs font-semibold">{p.id}</span>
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
