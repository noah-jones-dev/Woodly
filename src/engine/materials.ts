/**
 * Stock library: real-world dimensions and rough US prices.
 *
 * All library dimensions are stored in INCHES (actual, not nominal: a "2x4"
 * is 1.5" x 3.5"). Specs in millimetres are converted by the engine.
 * Prices are rough 2026 big-box estimates and are always labelled as such.
 */

export type BoardStock = {
  kind: "board";
  key: string;
  name: string;
  species: string;
  nominal: string;
  thickness: number;
  width: number;
  /** Lengths sold, ascending. */
  lengths: number[];
  pricePerBoardFoot: number;
  hardwood: boolean;
};

export type SheetStock = {
  kind: "sheet";
  key: string;
  name: string;
  thickness: number;
  width: number; // across the grain
  length: number; // along the grain
  price: number;
};

/** Smaller "project panels" most stores sell, as a fraction of a full sheet's price. */
export const SHEET_PANELS = [
  { name: "2x4 ft panel", width: 24, length: 48, priceFactor: 0.34 },
  { name: "4x4 ft panel", width: 48, length: 48, priceFactor: 0.58 },
  { name: "4x8 ft sheet", width: 48, length: 96, priceFactor: 1 },
] as const;
export type SheetPanel = (typeof SHEET_PANELS)[number];

export type Stock = BoardStock | SheetStock;

export type HardwareStock = {
  key: string;
  name: string;
  category: "fastener" | "hinge" | "bracket" | "slide" | "anchor" | "misc";
  packSize: number;
  packPrice: number;
  alternatives: string[];
};

export type SupplyStock = {
  key: string;
  name: string;
  category: "adhesive" | "abrasive" | "finish" | "paint" | "misc";
  unit: string;
  price: number;
  alternatives: string[];
};

const NOMINAL_1X: [string, number][] = [
  ["1x2", 1.5],
  ["1x3", 2.5],
  ["1x4", 3.5],
  ["1x6", 5.5],
  ["1x8", 7.25],
  ["1x10", 9.25],
  ["1x12", 11.25],
];
const NOMINAL_2X: [string, number][] = [
  ["2x2", 1.5],
  ["2x3", 2.5],
  ["2x4", 3.5],
  ["2x6", 5.5],
  ["2x8", 7.25],
];

const SPECIES = [
  { id: "pine", name: "Common pine", pbf: 3.75, hardwood: false, lengths: [48, 72, 96] },
  { id: "poplar", name: "Poplar", pbf: 5.5, hardwood: true, lengths: [48, 72, 96] },
  { id: "oak", name: "Red oak", pbf: 9, hardwood: true, lengths: [48, 72, 96] },
];

function boards(): BoardStock[] {
  const out: BoardStock[] = [];
  for (const s of SPECIES) {
    for (const [nom, w] of NOMINAL_1X) {
      out.push({
        kind: "board",
        key: `${s.id}-${nom}`,
        name: `${s.name} ${nom}`,
        species: s.name,
        nominal: nom,
        thickness: 0.75,
        width: w,
        lengths: s.lengths,
        pricePerBoardFoot: s.pbf,
        hardwood: s.hardwood,
      });
    }
  }
  for (const [nom, w] of NOMINAL_2X) {
    out.push({
      kind: "board",
      key: `spf-${nom}`,
      name: `SPF construction ${nom}`,
      species: "Spruce-pine-fir",
      nominal: nom,
      thickness: 1.5,
      width: w,
      lengths: [96, 120, 144],
      pricePerBoardFoot: 0.95,
      hardwood: false,
    });
  }
  // 4x4 posts
  out.push({
    kind: "board",
    key: "spf-4x4",
    name: "Pressure-treated 4x4 post",
    species: "Pressure-treated pine",
    nominal: "4x4",
    thickness: 3.5,
    width: 3.5,
    lengths: [96],
    pricePerBoardFoot: 1.4,
    hardwood: false,
  });
  return out;
}

const SHEETS: SheetStock[] = [
  { kind: "sheet", key: "ply-3/4", name: '3/4" birch plywood (4x8)', thickness: 0.75, width: 48, length: 96, price: 78 },
  { kind: "sheet", key: "ply-1/2", name: '1/2" birch plywood (4x8)', thickness: 0.5, width: 48, length: 96, price: 58 },
  { kind: "sheet", key: "ply-1/4", name: '1/4" birch plywood (4x8)', thickness: 0.25, width: 48, length: 96, price: 36 },
  { kind: "sheet", key: "mdf-3/4", name: '3/4" MDF (4x8)', thickness: 0.75, width: 48, length: 96, price: 46 },
  { kind: "sheet", key: "osb-7/16", name: '7/16" OSB (4x8)', thickness: 0.4375, width: 48, length: 96, price: 18 },
];

export const STOCK: Record<string, Stock> = Object.fromEntries(
  [...boards(), ...SHEETS].map((s) => [s.key, s]),
);

export const HARDWARE: Record<string, HardwareStock> = Object.fromEntries(
  (
    [
      { key: "screw-1-1/4", name: '#8 x 1-1/4" wood screws', category: "fastener", packSize: 100, packPrice: 9, alternatives: ['#8 x 1-1/2" wood screws'] },
      { key: "screw-1-5/8", name: '#8 x 1-5/8" wood screws', category: "fastener", packSize: 100, packPrice: 10, alternatives: ['#8 x 1-1/2" wood screws'] },
      { key: "screw-2-1/2", name: '#9 x 2-1/2" construction screws', category: "fastener", packSize: 75, packPrice: 12, alternatives: ['3" deck screws'] },
      { key: "pocket-1-1/4", name: '1-1/4" coarse-thread pocket screws', category: "fastener", packSize: 100, packPrice: 8, alternatives: ['#8 x 1-1/4" washer-head screws'] },
      { key: "pocket-2-1/2", name: '2-1/2" coarse-thread pocket screws', category: "fastener", packSize: 50, packPrice: 9, alternatives: [] },
      { key: "brad-1-1/4", name: '18-gauge 1-1/4" brad nails', category: "fastener", packSize: 1000, packPrice: 7, alternatives: ['3/4" panel nails + hammer'] },
      { key: "dowel-3/8", name: '3/8" x 2" fluted dowel pins', category: "fastener", packSize: 50, packPrice: 6, alternatives: ["#20 biscuits"] },
      { key: "hinge-butt", name: '2-1/2" butt hinges (pair)', category: "hinge", packSize: 2, packPrice: 8, alternatives: ["Piano hinge"] },
      { key: "hinge-piano", name: '1-1/16" x 30" piano hinge', category: "hinge", packSize: 1, packPrice: 14, alternatives: ["2-3 butt hinges"] },
      { key: "lid-stay", name: "Soft-close lid support", category: "hinge", packSize: 1, packPrice: 12, alternatives: ["Friction lid stay"] },
      { key: "bracket-l", name: '1-1/2" L-brackets', category: "bracket", packSize: 4, packPrice: 5, alternatives: ["Corner braces"] },
      { key: "desktop-fastener", name: "Figure-8 desktop fasteners", category: "bracket", packSize: 8, packPrice: 7, alternatives: ["Z-clips"] },
      { key: "floating-bracket", name: 'Heavy-duty floating shelf bracket (24")', category: "bracket", packSize: 1, packPrice: 22, alternatives: ["French cleat (DIY)"] },
      { key: "lag-3", name: '1/4" x 3" lag screws', category: "anchor", packSize: 10, packPrice: 7, alternatives: ['#10 x 3" structural screws'] },
      { key: "anti-tip", name: "Furniture anti-tip kit", category: "anchor", packSize: 2, packPrice: 9, alternatives: ["L-bracket into wall stud"] },
      { key: "felt-pad", name: "Felt furniture pads", category: "misc", packSize: 16, packPrice: 5, alternatives: ["Nylon glides"] },
      { key: "shelf-pin", name: '1/4" shelf pins', category: "misc", packSize: 20, packPrice: 5, alternatives: [] },
      { key: "drawer-slide-18", name: '18" full-extension drawer slides (pair)', category: "slide", packSize: 2, packPrice: 16, alternatives: ["Wooden runners"] },
    ] satisfies HardwareStock[]
  ).map((h) => [h.key, h]),
);

export const SUPPLIES: Record<string, SupplyStock> = Object.fromEntries(
  (
    [
      { key: "wood-glue", name: "Wood glue (8 oz)", category: "adhesive", unit: "bottle", price: 6, alternatives: ["Titebond III for outdoor use"] },
      { key: "sandpaper-kit", name: "Sandpaper assortment (120/180/220)", category: "abrasive", unit: "pack", price: 12, alternatives: ["Sanding sponges"] },
      { key: "wood-filler", name: "Stainable wood filler", category: "misc", unit: "tub", price: 7, alternatives: ["Glue + sawdust paste"] },
      { key: "pre-stain", name: "Pre-stain wood conditioner (qt)", category: "finish", unit: "can", price: 14, alternatives: [] },
      { key: "stain", name: "Oil-based wood stain (qt)", category: "finish", unit: "can", price: 15, alternatives: ["Water-based stain", "Gel stain"] },
      { key: "polyurethane", name: "Wipe-on polyurethane (qt)", category: "finish", unit: "can", price: 18, alternatives: ["Water-based poly", "Hardwax oil"] },
      { key: "exterior-finish", name: "Exterior deck stain/sealer (gal)", category: "finish", unit: "can", price: 38, alternatives: [] },
      { key: "primer", name: "Wood primer (qt)", category: "paint", unit: "can", price: 14, alternatives: [] },
      { key: "paint", name: "Satin latex paint (qt)", category: "paint", unit: "can", price: 20, alternatives: [] },
      { key: "rags", name: "Lint-free finishing rags", category: "misc", unit: "pack", price: 8, alternatives: ["Old cotton T-shirts"] },
    ] satisfies SupplyStock[]
  ).map((s) => [s.key, s]),
);

export function boardFeet(thicknessIn: number, widthIn: number, lengthIn: number): number {
  return (thicknessIn * widthIn * lengthIn) / 144;
}

export function boardPrice(s: BoardStock, lengthIn: number): number {
  // Lumber is priced on nominal thickness (3/4" board ≈ 1" nominal).
  const nominalT = s.thickness < 1 ? 1 : s.thickness < 2 ? 2 : 4;
  const nominalW = Math.ceil(s.width + 0.5);
  // Boards longer than 8 ft cost more per foot (fewer straight long trees).
  const longPremium = lengthIn > 96 ? 1.1 : 1;
  return Math.round(boardFeet(nominalT, nominalW, lengthIn) * s.pricePerBoardFoot * longPremium * 100) / 100;
}
