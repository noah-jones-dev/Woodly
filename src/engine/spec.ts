/**
 * Woodly Project Specification (schema v1)
 * =========================================
 *
 * This is the single source of truth for a project. The AI never draws
 * pictures or does arithmetic that matters: it writes *this* document, and
 * Woodly's deterministic engine derives everything else (geometry, cut list,
 * shopping list, drawings, 3D model, validation) from it.
 *
 * The key idea is that sizes and positions are **expressions** over named
 * parameters, e.g. `"x": "width - 2*t"`. Changing `width` from 48 to 60
 * re-evaluates every expression, so the whole design stays consistent.
 *
 * Coordinate system (right-handed, same as most CAD):
 *   x → left-to-right (width)
 *   y → front-to-back (depth)  – y = 0 is the FRONT face
 *   z → bottom-to-top (height) – z = 0 is the floor
 * Every component is an axis-aligned box. `position` is its min corner
 * (front-left-bottom), `size` is its extent along x, y, z.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

/** An expression string ("width/2 - t") or a plain number. */
export const Expr = z.union([z.number(), z.string().min(1)]);
export type Expr = z.infer<typeof Expr>;

export const Vec3Expr = z.object({ x: Expr, y: Expr, z: Expr });
export type Vec3Expr = z.infer<typeof Vec3Expr>;

export const Difficulty = z.enum(["complete-beginner", "beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const Units = z.enum(["in", "mm"]);
export type Units = z.infer<typeof Units>;

/** A user-tweakable number, e.g. overall width. */
export const Parameter = z.object({
  key: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "parameter keys must be identifiers"),
  label: z.string(),
  value: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  /** "length" values are shown with units; "count" values are plain integers. */
  kind: z.enum(["length", "count"]).default("length"),
  description: z.string().optional(),
});
export type Parameter = z.infer<typeof Parameter>;

/** An intermediate value computed from parameters, e.g. innerWidth. */
export const Derived = z.object({ key: z.string(), expr: Expr, description: z.string().optional() });
export type Derived = z.infer<typeof Derived>;

/**
 * Material used in this project. `stock` references an entry in the
 * built-in stock library (see materials.ts) so real-world dimensions and
 * prices come from data we control, not from the AI.
 */
export const ProjectMaterial = z.object({
  id: z.string(),
  stock: z.string(),
  /** Optional species/finish override shown to the user, e.g. "Red oak". */
  species: z.string().optional(),
});
export type ProjectMaterial = z.infer<typeof ProjectMaterial>;

export const Component = z.object({
  /** IKEA-style identifier, e.g. "A1". */
  id: z.string().regex(/^[A-Z][0-9]{1,2}$/, "component ids look like A1, B2, C10"),
  name: z.string(),
  material: z.string(),
  size: Vec3Expr,
  /**
   * One entry per physical piece (quantity = positions.length), OR exactly
   * one entry plus `repeat`, in which case the position is evaluated for
   * i = 0..count-1 (use the loop variable, default "i", in expressions).
   */
  positions: z.array(Vec3Expr).min(1),
  repeat: z.object({ count: Expr, var: z.string().default("i") }).optional(),
  /** Which axis the wood grain / long dimension runs along. */
  grain: z.enum(["x", "y", "z"]),
  notes: z.array(z.string()).default([]),
  /** Holes, pocket holes, etc. — descriptive for now. */
  drilling: z.array(z.string()).default([]),
  /** Non-square cuts the cut list should mention (miters, notches...). */
  cuts: z.array(z.string()).default([]),
});
export type Component = z.infer<typeof Component>;

export const JointType = z.enum([
  "butt-screw",
  "pocket-hole",
  "dado",
  "rabbet",
  "dowel",
  "biscuit",
  "mortise-tenon",
  "glue-only",
  "bracket",
  "hinge",
  "nail",
]);
export type JointType = z.infer<typeof JointType>;

export const Joint = z.object({
  a: z.string(),
  b: z.string(),
  type: JointType,
  hardware: z.string().optional(),
  count: Expr.optional(),
  note: z.string().optional(),
});
export type Joint = z.infer<typeof Joint>;

export const HardwareItem = z.object({
  id: z.string(),
  /** Key into the hardware library (materials.ts), or free text name. */
  stock: z.string(),
  quantity: Expr,
  usage: z.string(),
});
export type HardwareItem = z.infer<typeof HardwareItem>;

export const SupplyItem = z.object({
  stock: z.string(),
  quantity: Expr,
  usage: z.string(),
});
export type SupplyItem = z.infer<typeof SupplyItem>;

export const ToolRequirement = z.object({
  tool: z.string(),
  essential: z.boolean(),
  reason: z.string(),
});
export type ToolRequirement = z.infer<typeof ToolRequirement>;

export const Step = z.object({
  title: z.string(),
  description: z.string(),
  /** Components newly placed in this step. */
  components: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  hardware: z.array(z.object({ id: z.string(), quantity: Expr })).default([]),
  tips: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  /** Lesson keys from the Learn library this step teaches. */
  techniques: z.array(z.string()).default([]),
});
export type Step = z.infer<typeof Step>;

export const ProjectSpec = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  summary: z.string(),
  style: z.string().optional(),
  units: Units,
  difficulty: Difficulty,
  estimatedHours: z.number().positive(),
  parameters: z.array(Parameter),
  derived: z.array(Derived).default([]),
  materials: z.array(ProjectMaterial).min(1),
  components: z.array(Component).min(1),
  joints: z.array(Joint).default([]),
  hardware: z.array(HardwareItem).default([]),
  supplies: z.array(SupplyItem).default([]),
  tools: z.array(ToolRequirement).default([]),
  steps: z.array(Step).min(1),
  /** Things the design takes for granted, e.g. "Mounted to wall studs". */
  assumptions: z.array(z.string()).default([]),
  /** Regulated / high-risk aspects that need a professional. */
  riskFlags: z.array(z.string()).default([]),
});
export type ProjectSpec = z.infer<typeof ProjectSpec>;
/** Input type: what a template author / the AI may omit (defaults fill in). */
export type ProjectSpecInput = z.input<typeof ProjectSpec>;

export function parseSpec(data: unknown): ProjectSpec {
  return ProjectSpec.parse(data);
}
