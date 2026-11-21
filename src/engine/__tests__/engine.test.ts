import { describe, expect, it } from "vitest";
import { evaluate, buildScope, ExprError } from "../expr";
import { analyze, parseQuickEdit, setParameter } from "../index";
import { formatInches } from "../format";
import { TEMPLATES, matchTemplate } from "@/templates";

describe("expression evaluator", () => {
  it("handles precedence, unary minus and functions", () => {
    expect(evaluate("2 + 3*4", {})).toBe(14);
    expect(evaluate("-(2 + 3) * 2", {})).toBe(-10);
    expect(evaluate("max(1, w/2) - .25", { w: 10 })).toBe(4.75);
    expect(evaluate("floor(7/2)", {})).toBe(3);
  });
  it("rejects unknown names, functions and code", () => {
    expect(() => evaluate("x + 1", {})).toThrow(ExprError);
    expect(() => evaluate("alert(1)", {})).toThrow(ExprError);
    expect(() => evaluate("process.exit()", {})).toThrow(ExprError);
    expect(() => evaluate("1/0", {})).toThrow(ExprError);
  });
  it("resolves derived values in dependency order and detects cycles", () => {
    const s = buildScope([{ key: "w", value: 10 }], [{ key: "b", expr: "a * 2" }, { key: "a", expr: "w - 1" }]);
    expect(s.b).toBe(18);
    expect(() => buildScope([], [{ key: "a", expr: "b" }, { key: "b", expr: "a" }])).toThrow(/Circular/);
  });
});

describe("formatting", () => {
  it("formats inches as fractions", () => {
    expect(formatInches(28.5)).toBe('28-1/2"');
    expect(formatInches(0.75)).toBe('3/4"');
    expect(formatInches(11.25)).toBe('11-1/4"');
    expect(formatInches(3.99)).toBe('4"');
  });
});

describe("templates", () => {
  for (const t of TEMPLATES) {
    it(`${t.key} validates with no errors`, () => {
      const a = analyze(t.spec);
      const errors = a.validation.issues.filter((i) => i.severity === "error");
      expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
      expect(a.validation.status).not.toBe("blocked");
      expect(a.cutList.length).toBe(t.spec.components.length);
      expect(a.estimatedCost).toBeGreaterThan(0);
    });
    it(`${t.key} stays valid at parameter extremes`, () => {
      for (const p of t.spec.parameters) {
        for (const v of [p.min, p.max]) {
          if (v === undefined) continue;
          const a = analyze(setParameter(t.spec, p.key, v));
          const errors = a.validation.issues.filter((i) => i.severity === "error");
          expect(errors, `${p.key}=${v}: ${JSON.stringify(errors)}`).toEqual([]);
        }
      }
    });
  }

  it("matches prompts to templates", () => {
    expect(matchTemplate("I want a floating bookshelf above my desk")?.key).toBe("floating-shelf");
    expect(matchTemplate("Build me a modern farmhouse coffee table")?.key).toBe("coffee-table");
    expect(matchTemplate("a wooden storage bench with a hinged lid")?.key).toBe("storage-bench");
    expect(matchTemplate("gaming desk with cable management")?.key).toBe("desk");
    expect(matchTemplate("chicken coop for six chickens")).toBeUndefined();
  });
});

describe("parametric consistency", () => {
  const desk = TEMPLATES.find((t) => t.key === "desk")!.spec;
  it("'12 inches wider' updates the top, stretchers and tray together", () => {
    const edit = parseQuickEdit(desk, "Make the desk 12 inches wider")!;
    expect(edit).toEqual([{ key: "width", value: 60, label: "Width" }]);
    const before = analyze(desk);
    const after = analyze(setParameter(desk, "width", 60));
    const len = (a: typeof before, id: string) => a.cutList.find((r) => r.id === id)!.length;
    expect(len(after, "E1") - len(before, "E1")).toBeCloseTo(12);
    expect(len(after, "C1") - len(before, "C1")).toBeCloseTo(12);
    expect(len(after, "D1") - len(before, "D1")).toBeCloseTo(12);
    expect(len(after, "A1")).toBeCloseTo(len(before, "A1")); // legs unchanged
    expect(after.resolved.bbox.size.x).toBeCloseTo(60);
    expect(after.validation.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("adding a shelf adds a part", () => {
    const shelf = TEMPLATES.find((t) => t.key === "bookshelf")!.spec;
    const edit = parseQuickEdit(shelf, "add another shelf")!;
    const a = analyze(setParameter(shelf, edit[0].key, edit[0].value));
    expect(a.cutList.find((r) => r.id === "D1")!.quantity).toBe(4);
  });
});

describe("validation catches bad designs", () => {
  const base = TEMPLATES.find((t) => t.key === "storage-bench")!.spec;
  it("flags interference, floating parts and wrong stock thickness", () => {
    const bad = structuredClone(base);
    bad.components.push({ id: "Z1", name: "Floater", material: "ply", grain: "x", size: { x: 10, y: 10, z: 0.75 }, positions: [{ x: 100, y: 100, z: 100 }], notes: [], drilling: [], cuts: [] });
    bad.components.push({ id: "Z2", name: "Clash", material: "ply", grain: "x", size: { x: 5, y: 5, z: 2 }, positions: [{ x: 5, y: 5, z: 0 }], notes: [], drilling: [], cuts: [] });
    const codes = analyze(bad).validation.issues.map((i) => i.code);
    expect(codes).toContain("floating");
    expect(codes).toContain("interference");
    expect(codes).toContain("thickness");
    expect(codes).toContain("step-missing");
    expect(analyze(bad).validation.status).toBe("blocked");
  });
  it("flags regulated work", () => {
    const s = { ...base, summary: "A bench with built-in electrical outlet wiring" };
    expect(analyze(s).validation.issues.some((i) => i.code === "regulated")).toBe(true);
  });
});

describe("cut optimizer", () => {
  it("packs boards and never exceeds stock length", () => {
    const a = analyze(TEMPLATES.find((t) => t.key === "coffee-table")!.spec);
    for (const b of a.plan.boards) {
      const used = b.pieces.reduce((s, p) => s + p.length, 0);
      expect(used).toBeLessThanOrEqual(b.boardLength);
    }
    expect(a.plan.unplaceable).toEqual([]);
  });
  it("prefers standard 8 ft boards and buys small panels for small parts", () => {
    const a = analyze(TEMPLATES.find((t) => t.key === "desk")!.spec);
    expect(a.plan.boards.every((b) => b.boardLength <= 96)).toBe(true);
    expect(a.plan.sheets.find((s) => s.stockKey === "ply-1/2")!.panel.name).toBe("2x4 ft panel");
    expect(a.plan.wastePercent).toBeLessThan(50);
  });
  it("merges hardware that shares a stock item before rounding to packs", () => {
    const a = analyze(TEMPLATES.find((t) => t.key === "desk")!.spec);
    const screws = a.shopping.filter((i) => i.name.includes('1-1/4" wood screws'));
    expect(screws).toHaveLength(1);
    expect(screws[0].quantity).toBe(1);
    expect(screws[0].usedIn).toHaveLength(2);
  });
  it("keeps sheet parts inside the sheet without overlap", () => {
    const a = analyze(TEMPLATES.find((t) => t.key === "storage-bench")!.spec);
    for (const s of a.plan.sheets) {
      for (const p of s.placements) {
        expect(p.x + p.length).toBeLessThanOrEqual(s.panel.length + 1e-6);
        expect(p.y + p.width).toBeLessThanOrEqual(s.panel.width + 1e-6);
      }
      for (let i = 0; i < s.placements.length; i++)
        for (let j = i + 1; j < s.placements.length; j++) {
          const A = s.placements[i], B = s.placements[j];
          const overlap = A.x < B.x + B.length && B.x < A.x + A.length && A.y < B.y + B.width && B.y < A.y + A.width;
          expect(overlap).toBe(false);
        }
    }
  });
});
