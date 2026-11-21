/**
 * Shopping list — derived from the cut plan (whole boards/sheets you can
 * actually buy) plus hardware and supplies, rounded up to store pack sizes.
 */
import { evaluate } from "./expr";
import { HARDWARE, STOCK, SUPPLIES } from "./materials";
import type { CutPlan } from "./cutlist";
import type { ResolvedProject } from "./resolve";

export type ShoppingItem = {
  key: string;
  category: "lumber" | "sheet" | "hardware" | "supply";
  name: string;
  /** What you buy (boards, sheets, packs, cans). */
  quantity: number;
  unit: string;
  /** What the project consumes, e.g. "64 screws". */
  needed?: string;
  unitPrice: number;
  total: number;
  usedIn: string[];
  alternatives: string[];
};

export function buildShoppingList(p: ResolvedProject, plan: CutPlan): ShoppingItem[] {
  const items: ShoppingItem[] = [];

  // Lumber: group boards by stock + length.
  const boardGroups = new Map<string, { plan: CutPlan["boards"][number]; count: number; parts: Set<string> }>();
  for (const b of plan.boards) {
    const k = `${b.stockKey}@${b.boardLength}`;
    const g = boardGroups.get(k) ?? { plan: b, count: 0, parts: new Set<string>() };
    g.count++;
    b.pieces.forEach((pc) => g.parts.add(pc.partId));
    boardGroups.set(k, g);
  }
  for (const [k, g] of boardGroups) {
    const feet = g.plan.boardLength / 12;
    items.push({
      key: k,
      category: "lumber",
      name: `${g.plan.stock.name} × ${feet} ft`,
      quantity: g.count,
      unit: g.count === 1 ? "board" : "boards",
      unitPrice: g.plan.price,
      total: round(g.plan.price * g.count),
      usedIn: [...g.parts].sort(),
      alternatives: alternativesForBoard(g.plan.stockKey),
    });
  }

  const sheetGroups = new Map<string, { s: CutPlan["sheets"][number]; count: number; parts: Set<string> }>();
  for (const s of plan.sheets) {
    const k = `${s.stockKey}@${s.panel.name}`;
    const g = sheetGroups.get(k) ?? { s, count: 0, parts: new Set<string>() };
    g.count++;
    s.placements.forEach((pc) => g.parts.add(pc.partId));
    sheetGroups.set(k, g);
  }
  for (const [k, g] of sheetGroups) {
    const full = g.s.panel.length === g.s.stock.length && g.s.panel.width === g.s.stock.width;
    items.push({
      key: k,
      category: "sheet",
      name: full ? g.s.stock.name : `${g.s.stock.name.replace(/ \(4x8\)/, "")} — ${g.s.panel.name}`,
      quantity: g.count,
      unit: full ? (g.count === 1 ? "sheet" : "sheets") : g.count === 1 ? "panel" : "panels",
      unitPrice: g.s.price,
      total: round(g.s.price * g.count),
      usedIn: [...g.parts].sort(),
      alternatives: [
        ...(!full ? ["Buy a full 4x8 sheet if panels aren't stocked (most stores will cut it down)"] : []),
        ...(g.s.stockKey.startsWith("ply") ? ["MDF (paint-grade, heavier)", "Sanded pine plywood (cheaper)"] : []),
      ],
    });
  }

  // Hardware: merge entries that use the same stock item before rounding up
  // to packs (two jobs needing 12 screws each = one pack, not two).
  const hw = new Map<string, { qty: number; usage: string[] }>();
  for (const h of p.spec.hardware) {
    let qty = 0;
    try {
      qty = Math.ceil(evaluate(h.quantity, p.scope));
    } catch {
      /* reported by validation */
    }
    const g = hw.get(h.stock) ?? { qty: 0, usage: [] };
    g.qty += qty;
    g.usage.push(h.usage);
    hw.set(h.stock, g);
  }
  for (const [stockKey, { qty, usage }] of hw) {
    const stock = HARDWARE[stockKey];
    const packs = stock ? Math.max(1, Math.ceil(qty / stock.packSize)) : qty;
    items.push({
      key: `hw-${stockKey}`,
      category: "hardware",
      name: stock?.name ?? stockKey,
      quantity: packs,
      unit: stock && stock.packSize > 1 ? (packs === 1 ? "pack" : "packs") : "ea",
      needed: stock && stock.packSize > 1 ? `${qty} needed (${stock.packSize}/pack)` : undefined,
      unitPrice: stock?.packPrice ?? 0,
      total: round((stock?.packPrice ?? 0) * packs),
      usedIn: usage,
      alternatives: stock?.alternatives ?? [],
    });
  }

  for (const s of p.spec.supplies) {
    let qty = 1;
    try {
      qty = Math.max(1, Math.ceil(evaluate(s.quantity, p.scope)));
    } catch {
      /* reported by validation */
    }
    const stock = SUPPLIES[s.stock];
    items.push({
      key: `supply-${s.stock}`,
      category: "supply",
      name: stock?.name ?? s.stock,
      quantity: qty,
      unit: stock?.unit ?? "ea",
      unitPrice: stock?.price ?? 0,
      total: round((stock?.price ?? 0) * qty),
      usedIn: [s.usage],
      alternatives: stock?.alternatives ?? [],
    });
  }
  return items;
}

function alternativesForBoard(key: string): string[] {
  const s = STOCK[key];
  if (!s || s.kind !== "board") return [];
  return Object.values(STOCK)
    .filter((o) => o.kind === "board" && o.key !== key && o.nominal === s.nominal)
    .map((o) => o.name);
}

const round = (v: number) => Math.round(v * 100) / 100;

export const shoppingTotal = (items: ShoppingItem[]) => round(items.reduce((s, i) => s + i.total, 0));
