import { HARDWARE, STOCK, SUPPLIES, boardPrice } from "@/engine/materials";
import { formatFromInches, money } from "@/engine/format";
import { useApp } from "@/state/store";
import { PageHeader } from "@/components/ui";

export default function MaterialsLibrary() {
  const units = useApp((s) => s.settings.profile.units);
  const f = (v: number) => formatFromInches(v, units);
  const boards = Object.values(STOCK).filter((s) => s.kind === "board");
  const sheets = Object.values(STOCK).filter((s) => s.kind === "sheet");
  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader title="Materials library" subtitle="Real (actual) dimensions and rough US prices that Woodly designs with. Nominal sizes like “2x4” are not the true size." />
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-charcoal-700/70"><tr className="border-b border-cream-200"><th className="px-3 py-2">Board</th><th>Nominal</th><th>Actual T × W</th><th>Lengths</th><th>8 ft price</th></tr></thead>
          <tbody>
            {boards.map((b) => b.kind === "board" && (
              <tr key={b.key} className="border-b border-cream-200/60"><td className="px-3 py-1.5">{b.species}</td><td>{b.nominal}</td><td className="font-mono">{f(b.thickness)} × {f(b.width)}</td><td>{b.lengths.map((l) => `${l / 12}'`).join(", ")}</td><td>{money(boardPrice(b, 96))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Sheet goods</h3>
          <ul className="space-y-1 text-sm">{sheets.map((s) => s.kind === "sheet" && <li key={s.key}>{s.name} — {f(s.thickness)} · {money(s.price)}</li>)}</ul>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Hardware</h3>
          <ul className="space-y-1 text-sm">{Object.values(HARDWARE).map((h) => <li key={h.key}>{h.name} — {h.packSize > 1 ? `${h.packSize}/pack, ` : ""}{money(h.packPrice)}</li>)}</ul>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-semibold">Supplies & finishes</h3>
          <ul className="space-y-1 text-sm">{Object.values(SUPPLIES).map((s) => <li key={s.key}>{s.name} — {money(s.price)}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
