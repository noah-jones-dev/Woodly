/**
 * Cut list + cut optimizer.
 *
 * Boards (1D): First-Fit Decreasing bin packing. Sort pieces longest-first,
 * drop each into the first board with room (accounting for saw kerf), open a
 * new board if none fits, then shrink each board to the shortest length the
 * store sells that still holds its pieces.
 *
 * Sheets (2D): guillotine "shelf" packing. The sheet is split into strips
 * running along the grain; pieces fill strips left to right. Every cut goes
 * fully across a strip, which is how you cut plywood with a circular saw or
 * track saw (no plunge cuts needed). Grain direction is preserved.
 *
 * Both are heuristics — fast and good, not mathematically optimal.
 */
import type { BoardStock, SheetStock } from "./materials";
import { boardPrice, SHEET_PANELS, type SheetPanel } from "./materials";
import type { ResolvedProject } from "./resolve";

export const KERF_IN = 0.125; // typical saw blade width
export const END_TRIM_IN = 0.5; // square up factory ends

export type CutListRow = {
  id: string;
  name: string;
  quantity: number;
  material: string;
  thickness: number;
  width: number;
  length: number;
  /** Width must be ripped down from the stock board. */
  needsRip: boolean;
  cuts: string[];
  drilling: string[];
  notes: string[];
};

export function buildCutList(p: ResolvedProject): CutListRow[] {
  return p.parts.map((part) => {
    const stockWidth = part.stock ? part.stock.width / p.toInches : undefined;
    return {
      id: part.id,
      name: part.name,
      quantity: part.instances.length,
      material: part.materialName,
      thickness: part.thickness,
      width: part.width,
      length: part.length,
      needsRip: part.stock?.kind === "board" && stockWidth !== undefined && part.width < stockWidth - 0.02 / p.toInches,
      cuts: part.source.cuts,
      drilling: part.source.drilling,
      notes: part.source.notes,
    };
  });
}

export type Piece = { partId: string; label: string; length: number; width: number };

export type BoardPlan = {
  stockKey: string;
  stock: BoardStock;
  boardLength: number; // inches
  pieces: (Piece & { offset: number })[];
  used: number;
  price: number;
};

export type SheetPlacement = Piece & { x: number; y: number; rotated: boolean };
export type SheetPlan = {
  stockKey: string;
  stock: SheetStock;
  /** The size actually bought: a full sheet or a smaller project panel. */
  panel: SheetPanel;
  placements: SheetPlacement[];
  utilization: number;
  price: number;
};

export type CutPlan = {
  boards: BoardPlan[];
  sheets: SheetPlan[];
  /** Pieces that can't be cut from their stock at all. */
  unplaceable: { partId: string; reason: string }[];
  wastePercent: number;
  totalPrice: number;
};

/** All lengths here are inches. */
export function optimizeCuts(p: ResolvedProject): CutPlan {
  const byStock = new Map<string, Piece[]>();
  const unplaceable: CutPlan["unplaceable"] = [];
  for (const part of p.parts) {
    if (!part.stock) {
      unplaceable.push({ partId: part.id, reason: `Unknown material "${part.materialId}"` });
      continue;
    }
    const list = byStock.get(part.stock.key) ?? [];
    part.instances.forEach((_, i) =>
      list.push({
        partId: part.id,
        label: part.instances.length > 1 ? `${part.id}.${i + 1}` : part.id,
        length: part.length * p.toInches,
        width: part.width * p.toInches,
      }),
    );
    byStock.set(part.stock.key, list);
  }

  const boards: BoardPlan[] = [];
  const sheets: SheetPlan[] = [];
  let usedArea = 0;
  let boughtArea = 0;

  for (const [key, pieces] of byStock) {
    const stock = p.parts.find((x) => x.stock?.key === key)!.stock!;
    if (stock.kind === "board") {
      const plans = packBoards(stock, pieces, unplaceable);
      for (const b of plans) {
        usedArea += b.pieces.reduce((s, x) => s + x.length * x.width, 0);
        boughtArea += b.boardLength * stock.width;
      }
      boards.push(...plans);
    } else {
      const plans = packSheets(stock, pieces, unplaceable);
      for (const s of plans) {
        usedArea += s.placements.reduce((acc, x) => acc + x.length * x.width, 0);
        boughtArea += s.panel.length * s.panel.width;
      }
      sheets.push(...plans);
    }
  }

  const totalPrice = [...boards, ...sheets].reduce((s, x) => s + x.price, 0);
  return {
    boards,
    sheets,
    unplaceable,
    wastePercent: boughtArea ? Math.round((1 - usedArea / boughtArea) * 1000) / 10 : 0,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

function packBoards(stock: BoardStock, pieces: Piece[], unplaceable: CutPlan["unplaceable"]): BoardPlan[] {
  const maxLen = stock.lengths[stock.lengths.length - 1];
  const fits: Piece[] = [];
  for (const pc of pieces) {
    if (pc.width > stock.width + 0.01) unplaceable.push({ partId: pc.partId, reason: `${pc.label} is wider than a ${stock.nominal} board` });
    else if (pc.length > maxLen - END_TRIM_IN) unplaceable.push({ partId: pc.partId, reason: `${pc.label} is longer than the longest ${stock.nominal} sold (${maxLen}")` });
    else fits.push(pc);
  }
  if (!fits.length) return [];
  // Try packing into each sold length; keep the cheapest plan (ties → shorter
  // boards, which are easier to transport and handle).
  let best: BoardPlan[] | undefined;
  let bestCost = Infinity;
  for (const L of stock.lengths) {
    const plan = packBoardsInto(stock, fits, L);
    if (!plan) continue;
    const cost = plan.reduce((s, b) => s + b.price, 0);
    if (cost < bestCost - 0.005) {
      best = plan;
      bestCost = cost;
    }
  }
  return best!;
}

/** First-Fit Decreasing into boards of length L. Returns undefined if a piece can't fit. */
function packBoardsInto(stock: BoardStock, pieces: Piece[], L: number): BoardPlan[] | undefined {
  const usable = L - END_TRIM_IN;
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  if (sorted[0].length > usable) return undefined;
  const bins: { pieces: (Piece & { offset: number })[]; used: number }[] = [];
  for (const pc of sorted) {
    // `used` already includes a kerf after every previous piece.
    let bin = bins.find((b) => usable - b.used >= pc.length - 1e-9);
    if (!bin) {
      bin = { pieces: [], used: 0 };
      bins.push(bin);
    }
    bin.pieces.push({ ...pc, offset: END_TRIM_IN / 2 + bin.used });
    bin.used += pc.length + KERF_IN;
  }
  return bins.map((b) => {
    // Shrink each board to the shortest length sold that still holds its pieces.
    const required = b.used - KERF_IN + END_TRIM_IN;
    const boardLength = stock.lengths.find((l) => l >= required - 1e-9) ?? L;
    return { stockKey: stock.key, stock, boardLength, pieces: b.pieces, used: b.used, price: boardPrice(stock, boardLength) };
  });
}

function packSheets(stock: SheetStock, pieces: Piece[], unplaceable: CutPlan["unplaceable"]): SheetPlan[] {
  const full = SHEET_PANELS[SHEET_PANELS.length - 1];
  const sheets = shelfPack(pieces, stock.length, stock.width, unplaceable);
  return sheets.map((placements) => {
    // Would this sheet's parts fit on a smaller project panel? Re-pack them
    // into each smaller size (smallest first) and take the first that works.
    for (const panel of SHEET_PANELS) {
      if (panel === full) break;
      const trial: CutPlan["unplaceable"] = [];
      const packed = shelfPack(placements, panel.length, panel.width, trial, false);
      if (!trial.length && packed.length === 1) return sheetPlan(stock, panel, packed[0]);
    }
    return sheetPlan(stock, full, placements);
  });
}

function sheetPlan(stock: SheetStock, panel: SheetPanel, placements: SheetPlacement[]): SheetPlan {
  return {
    stockKey: stock.key,
    stock,
    panel,
    placements,
    utilization: placements.reduce((a, x) => a + x.length * x.width, 0) / (panel.length * panel.width),
    price: Math.round(stock.price * panel.priceFactor * 100) / 100,
  };
}

/**
 * Guillotine shelf packing into L (along grain) × W sheets. Returns the
 * placements for each sheet used. Pieces that already carry a rotation keep
 * it; `allowRotate` lets oversized pieces turn 90° (grain flagged).
 */
function shelfPack(pieces: (Piece & { rotated?: boolean })[], L: number, W: number, unplaceable: CutPlan["unplaceable"], allowRotate = true): SheetPlacement[][] {
  type Strip = { y: number; height: number; usedX: number };
  type Sheet = { strips: Strip[]; usedY: number; placements: SheetPlacement[] };
  const sheets: Sheet[] = [];
  const sorted = [...pieces].sort((a, b) => b.width - a.width || b.length - a.length);

  for (const pc of sorted) {
    let len = pc.length;
    let wid = pc.width;
    let rotated = pc.rotated ?? false;
    if (len > L + 1e-9 || wid > W + 1e-9) {
      // Try turning the piece 90° (loses grain direction – flagged).
      if (allowRotate && wid <= L && len <= W) {
        [len, wid] = [wid, len];
        rotated = true;
      } else {
        unplaceable.push({ partId: pc.partId, reason: `${pc.label} is larger than a ${W}x${L} sheet` });
        continue;
      }
    }
    // Best fit: strip with the least wasted height that has room.
    let best: { sheet: Sheet; strip: Strip } | undefined;
    for (const sh of sheets)
      for (const st of sh.strips)
        if (st.height >= wid - 1e-9 && L - st.usedX >= len - 1e-9 && (!best || st.height < best.strip.height)) best = { sheet: sh, strip: st };
    if (!best) {
      let sheet = sheets.find((sh) => W - sh.usedY >= wid - 1e-9);
      if (!sheet) {
        sheet = { strips: [], usedY: 0, placements: [] };
        sheets.push(sheet);
      }
      const strip = { y: sheet.usedY, height: wid, usedX: 0 };
      sheet.strips.push(strip);
      sheet.usedY += wid + KERF_IN;
      best = { sheet, strip };
    }
    best.sheet.placements.push({ partId: pc.partId, label: pc.label, length: len, width: wid, x: best.strip.usedX, y: best.strip.y, rotated });
    best.strip.usedX += len + KERF_IN;
  }
  return sheets.map((s) => s.placements);
}
