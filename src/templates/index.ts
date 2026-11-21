/**
 * Built-in parametric templates. They are written in exactly the same spec
 * format the AI produces, so they serve three purposes:
 *   1. offline / no-API-key project creation,
 *   2. worked examples included in the AI prompt,
 *   3. regression tests for the engine (every template must validate).
 */
import { ProjectSpec, type ProjectSpecInput } from "@/engine/spec";

const SAFETY_TOOLS = [
  { tool: "safety-glasses", essential: true, reason: "Eye protection for every cut and drilled hole." },
  { tool: "hearing-protection", essential: true, reason: "Saws are loud enough to damage hearing." },
];

const bookshelf: ProjectSpecInput = {
  schemaVersion: 1,
  name: "Classic Bookshelf",
  summary: "A sturdy, simple bookshelf made from 1x12 pine boards with a recessed kick plate and a 1/4\" plywood back. Screwed-and-glued butt joints keep it beginner friendly.",
  style: "Modern farmhouse",
  units: "in",
  difficulty: "beginner",
  estimatedHours: 6,
  parameters: [
    { key: "width", label: "Overall width", value: 30, min: 18, max: 40, step: 0.5, kind: "length" },
    { key: "height", label: "Overall height", value: 60, min: 30, max: 84, step: 0.5, kind: "length" },
    { key: "depth", label: "Depth", value: 11.25, min: 7.25, max: 11.25, step: 0.25, kind: "length", description: "Max 11-1/4\" (the width of a 1x12). Narrower depths require ripping the boards." },
    { key: "shelves", label: "Inner shelves", value: 3, min: 0, max: 8, step: 1, kind: "count" },
  ],
  derived: [
    { key: "t", expr: 0.75, description: "Board thickness" },
    { key: "kick", expr: 3.5, description: "Kick plate height (a 1x4)" },
    { key: "innerW", expr: "width - 2*t" },
    { key: "gap", expr: "(height - t - (kick + t)) / (shelves + 1)", description: "Spacing between shelf centers" },
  ],
  materials: [
    { id: "board", stock: "pine-1x12" },
    { id: "kickboard", stock: "pine-1x4" },
    { id: "back", stock: "ply-1/4" },
  ],
  components: [
    { id: "A1", name: "Side panel", material: "board", grain: "z", size: { x: "t", y: "depth", z: "height" }, positions: [{ x: 0, y: 0, z: 0 }, { x: "width - t", y: 0, z: 0 }], drilling: ["Countersunk pilot holes for each shelf, 3 per joint, 3/8\" from the edge of the shelf line"] },
    { id: "B1", name: "Top", material: "board", grain: "x", size: { x: "innerW", y: "depth", z: "t" }, positions: [{ x: "t", y: 0, z: "height - t" }] },
    { id: "B2", name: "Bottom shelf", material: "board", grain: "x", size: { x: "innerW", y: "depth", z: "t" }, positions: [{ x: "t", y: 0, z: "kick" }] },
    { id: "C1", name: "Kick plate", material: "kickboard", grain: "x", size: { x: "innerW", y: "t", z: "kick" }, positions: [{ x: "t", y: 0, z: 0 }] },
    { id: "D1", name: "Shelf", material: "board", grain: "x", size: { x: "innerW", y: "depth", z: "t" }, positions: [{ x: "t", y: 0, z: "kick + t + (i + 1)*gap - t/2" }], repeat: { count: "shelves" } },
    { id: "E1", name: "Back panel", material: "back", grain: "z", size: { x: "width", y: 0.25, z: "height" }, positions: [{ x: 0, y: "depth", z: 0 }] },
  ],
  joints: [
    { a: "A1", b: "B1", type: "butt-screw", hardware: "screws", note: "Glue + 3 screws per side" },
    { a: "A1", b: "B2", type: "butt-screw", hardware: "screws" },
    { a: "A1", b: "D1", type: "butt-screw", hardware: "screws" },
    { a: "A1", b: "C1", type: "butt-screw", hardware: "screws" },
    { a: "A1", b: "E1", type: "nail", hardware: "brads" },
  ],
  hardware: [
    { id: "screws", stock: "screw-1-5/8", quantity: "6*(shelves + 2) + 4", usage: "Sides into top, bottom, shelves and kick plate" },
    { id: "brads", stock: "brad-1-1/4", quantity: 40, usage: "Back panel" },
    { id: "antitip", stock: "anti-tip", quantity: 1, usage: "Anchor the top to a wall stud" },
  ],
  supplies: [
    { stock: "wood-glue", quantity: 1, usage: "Every butt joint" },
    { stock: "wood-filler", quantity: 1, usage: "Fill screw holes on the sides" },
    { stock: "sandpaper-kit", quantity: 1, usage: "Surface prep" },
    { stock: "polyurethane", quantity: 1, usage: "Protective finish" },
  ],
  tools: [
    { tool: "tape-measure", essential: true, reason: "Measure every part." },
    { tool: "speed-square", essential: true, reason: "Mark square cut lines and shelf positions." },
    { tool: "circular-saw", essential: true, reason: "Crosscut the boards to length." },
    { tool: "drill", essential: true, reason: "Pilot holes and screws." },
    { tool: "clamps", essential: true, reason: "Hold shelves in place while you screw." },
    { tool: "hammer", essential: false, reason: "Nail on the back if you don't have a brad nailer." },
    { tool: "orbital-sander", essential: false, reason: "Faster sanding; a block works too." },
    { tool: "stud-finder", essential: true, reason: "Locate a stud for the anti-tip strap." },
    ...SAFETY_TOOLS,
  ],
  steps: [
    { title: "Cut all the parts", description: "Cut the two sides to the full height, then cut the top, bottom and shelves to the inner width. Cut the kick plate from the 1x4. Label each piece with its letter.", tools: ["tape-measure", "speed-square", "circular-saw", "safety-glasses", "hearing-protection"], tips: ["Cut all the shelf-length parts with the same setup (a clamped stop block) so they match exactly."], warnings: ["Support both ends of the board so the offcut doesn't pinch the blade."], techniques: ["measuring-marking", "crosscuts"] },
    { title: "Build the box", description: "Lay one side flat. Glue and screw the top (B1) flush with its upper end and the bottom shelf (B2) 3-1/2\" above its lower end. Flip and attach the second side.", components: ["A1", "B1", "B2"], tools: ["drill", "clamps", "speed-square"], hardware: [{ id: "screws", quantity: 12 }], tips: ["Drill countersunk pilot holes so the pine doesn't split."], techniques: ["butt-joints", "drilling"] },
    { title: "Add the kick plate", description: "Fit the kick plate (C1) under the bottom shelf, flush with the front edges. Glue and screw through the sides.", components: ["C1"], tools: ["drill"], hardware: [{ id: "screws", quantity: 4 }] },
    { title: "Install the shelves", description: "Mark the shelf heights on both sides using the cut list spacing. Clamp each shelf at its line, check it's level, then glue and screw through the sides.", components: ["D1"], tools: ["drill", "clamps", "tape-measure"], hardware: [{ id: "screws", quantity: "6*shelves" }], tips: ["A scrap spacer block cut to the shelf gap makes every shelf land at the same height."] },
    { title: "Square it and attach the back", description: "Measure both diagonals of the case — when they're equal, it's square. Lay the back (E1) on and nail it every 6\" around the edges and along each shelf.", components: ["E1"], tools: ["hammer", "tape-measure"], hardware: [{ id: "brads", quantity: 40 }], tips: ["The back is what keeps the case square — nail it while the diagonals are equal."], techniques: ["squaring"] },
    { title: "Sand and finish", description: "Fill screw holes, sand everything to 180 grit, wipe off dust and apply 2–3 coats of polyurethane, lightly sanding between coats.", tools: ["orbital-sander"], warnings: ["Wear a dust mask. Lay oily rags flat to dry outdoors — they can self-ignite if bunched up."], techniques: ["sanding", "finishing"] },
    { title: "Anchor it to the wall", description: "Stand the bookshelf in place, find a stud and attach the anti-tip strap between the top and the stud.", tools: ["stud-finder", "drill"], hardware: [{ id: "antitip", quantity: 1 }], warnings: ["Tall furniture can tip onto children. Always anchor it."] },
  ],
  assumptions: ["Indoor use", "Moderate book loads on shelves under 30\" wide", "Anchored to a wall stud"],
};

const coffeeTable: ProjectSpecInput = {
  schemaVersion: 1,
  name: "Farmhouse Coffee Table",
  summary: "A modern farmhouse coffee table with a plank top, 2x4 legs, 1x4 aprons and a slatted lower shelf. Built entirely with pocket-hole joinery.",
  style: "Modern farmhouse",
  units: "in",
  difficulty: "beginner",
  estimatedHours: 8,
  parameters: [
    { key: "length", label: "Length", value: 44, min: 30, max: 60, step: 0.5, kind: "length" },
    { key: "topBoards", label: "Top planks (sets the width)", value: 4, min: 3, max: 6, step: 1, kind: "count", description: "Each 1x6 plank adds 5-1/2\" of width" },
    { key: "height", label: "Height", value: 18, min: 15, max: 22, step: 0.25, kind: "length" },
  ],
  derived: [
    { key: "t", expr: 0.75 },
    { key: "o", expr: 1.5, description: "Top overhang beyond the legs" },
    { key: "depth", expr: "topBoards * 5.5" },
    { key: "legH", expr: "height - t" },
    { key: "innerX", expr: "length - 2*o - 3" },
    { key: "innerY", expr: "depth - 2*o - 7" },
    { key: "shelfZ", expr: 4 },
    { key: "slats", expr: "floor((innerX + 1.5) / 5)" },
    { key: "slatGap", expr: "(innerX - slats*3.5) / (slats - 1)" },
  ],
  materials: [
    { id: "plank", stock: "pine-1x6" },
    { id: "leg", stock: "spf-2x4" },
    { id: "apron", stock: "pine-1x4" },
  ],
  components: [
    { id: "A1", name: "Top plank", material: "plank", grain: "x", size: { x: "length", y: 5.5, z: "t" }, positions: [{ x: 0, y: "i*5.5", z: "legH" }], repeat: { count: "topBoards" } },
    { id: "B1", name: "Leg", material: "leg", grain: "z", size: { x: 1.5, y: 3.5, z: "legH" }, positions: [{ x: "o", y: "o", z: 0 }, { x: "length - o - 1.5", y: "o", z: 0 }, { x: "o", y: "depth - o - 3.5", z: 0 }, { x: "length - o - 1.5", y: "depth - o - 3.5", z: 0 }] },
    { id: "C1", name: "Long apron", material: "apron", grain: "x", size: { x: "innerX", y: "t", z: 3.5 }, positions: [{ x: "o + 1.5", y: "o", z: "legH - 3.5" }, { x: "o + 1.5", y: "depth - o - t", z: "legH - 3.5" }], drilling: ["Two pocket holes at each end (inside face)", "Pocket holes every 8\" along the top edge for attaching the top"] },
    { id: "C2", name: "Short apron", material: "apron", grain: "y", size: { x: "t", y: "innerY", z: 3.5 }, positions: [{ x: "o", y: "o + 3.5", z: "legH - 3.5" }, { x: "length - o - t", y: "o + 3.5", z: "legH - 3.5" }], drilling: ["Two pocket holes at each end (inside face)"] },
    { id: "D1", name: "Lower stretcher", material: "apron", grain: "x", size: { x: "innerX", y: "t", z: 3.5 }, positions: [{ x: "o + 1.5", y: "o", z: "shelfZ" }, { x: "o + 1.5", y: "depth - o - t", z: "shelfZ" }], drilling: ["Two pocket holes at each end"] },
    { id: "E1", name: "Shelf slat", material: "apron", grain: "y", size: { x: 3.5, y: "depth - 2*o", z: "t" }, positions: [{ x: "o + 1.5 + i*(3.5 + slatGap)", y: "o", z: "shelfZ + 3.5" }], repeat: { count: "slats" }, drilling: ["Two countersunk pilot holes at each end"] },
  ],
  joints: [
    { a: "B1", b: "C1", type: "pocket-hole", hardware: "pocket" },
    { a: "B1", b: "C2", type: "pocket-hole", hardware: "pocket" },
    { a: "B1", b: "D1", type: "pocket-hole", hardware: "pocket" },
    { a: "C1", b: "A1", type: "pocket-hole", hardware: "pocket" },
    { a: "C2", b: "A1", type: "pocket-hole", hardware: "pocket" },
    { a: "E1", b: "D1", type: "butt-screw", hardware: "screws" },
  ],
  hardware: [
    { id: "pocket", stock: "pocket-1-1/4", quantity: "16 + 8 + 4*topBoards + 4", usage: "Aprons, stretchers and top" },
    { id: "screws", stock: "screw-1-1/4", quantity: "4*slats", usage: "Shelf slats" },
    { id: "pads", stock: "felt-pad", quantity: 4, usage: "Under the legs" },
  ],
  supplies: [
    { stock: "wood-glue", quantity: 1, usage: "Apron and stretcher joints" },
    { stock: "sandpaper-kit", quantity: 1, usage: "Surface prep" },
    { stock: "pre-stain", quantity: 1, usage: "Prevents blotchy pine stain" },
    { stock: "stain", quantity: 1, usage: "Color" },
    { stock: "polyurethane", quantity: 1, usage: "Durable top coat" },
    { stock: "rags", quantity: 1, usage: "Applying stain" },
  ],
  tools: [
    { tool: "tape-measure", essential: true, reason: "Measure every part." },
    { tool: "speed-square", essential: true, reason: "Square cuts and assemblies." },
    { tool: "miter-saw", essential: false, reason: "Fast, square crosscuts (a circular saw also works)." },
    { tool: "circular-saw", essential: true, reason: "Crosscut boards if you don't own a miter saw." },
    { tool: "drill", essential: true, reason: "Drill pocket holes and drive screws." },
    { tool: "pocket-hole-jig", essential: true, reason: "Hidden, strong joints for the frame and top." },
    { tool: "clamps", essential: true, reason: "Hold joints flush while screwing." },
    { tool: "orbital-sander", essential: false, reason: "Flatten and smooth the plank top." },
    ...SAFETY_TOOLS,
  ],
  steps: [
    { title: "Cut the parts", description: "Cut the legs, aprons, stretchers, slats and top planks to the lengths in the cut list.", tools: ["tape-measure", "speed-square", "circular-saw", "safety-glasses", "hearing-protection"], techniques: ["crosscuts", "measuring-marking"] },
    { title: "Drill pocket holes", description: "Drill two pocket holes at both ends of every apron and stretcher, plus pocket holes every 8\" along the top inside edge of the aprons.", tools: ["pocket-hole-jig", "drill"], tips: ["All pockets go on the inside faces so they won't show."], techniques: ["pocket-holes"] },
    { title: "Build the leg frame", description: "Attach the long and short aprons to the legs with glue and pocket screws, keeping the apron faces flush with the outside of the legs.", components: ["B1", "C1", "C2"], tools: ["clamps", "drill", "speed-square"], hardware: [{ id: "pocket", quantity: 16 }], tips: ["Check each corner with a square before the glue sets."] },
    { title: "Add the lower stretchers", description: "Attach the lower stretchers between the front and back leg pairs, 4\" above the floor.", components: ["D1"], tools: ["clamps", "drill"], hardware: [{ id: "pocket", quantity: 8 }], tips: ["Cut a 4\" spacer block to set the height of all four ends."] },
    { title: "Lay the shelf slats", description: "Space the slats evenly across the stretchers (see the cut list for the gap) and screw each end down.", components: ["E1"], tools: ["drill"], hardware: [{ id: "screws", quantity: "4*slats" }] },
    { title: "Attach the top planks", description: "Flip the base upside down onto the planks laid face-down. Center it so the overhang is even, then drive pocket screws up into each plank.", components: ["A1"], tools: ["drill", "clamps"], hardware: [{ id: "pocket", quantity: "4*topBoards + 4" }], tips: ["Don't glue the planks to each other — leaving them free lets the wood expand and shrink with humidity."], techniques: ["wood-movement"] },
    { title: "Sand and finish", description: "Sand the top flat, apply pre-stain conditioner, stain, and 3 coats of polyurethane. Add felt pads.", tools: ["orbital-sander"], hardware: [{ id: "pads", quantity: 4 }], warnings: ["Lay stain rags flat outdoors to dry — balled-up oily rags can catch fire."], techniques: ["sanding", "finishing"] },
  ],
  assumptions: ["Indoor use", "Normal living-room loads"],
};

const storageBench: ProjectSpecInput = {
  schemaVersion: 1,
  name: "Storage Bench with Hinged Lid",
  summary: "A plywood storage bench with a hinged lid, center divider for seat support, and soft-close lid stays to protect fingers.",
  style: "Modern",
  units: "in",
  difficulty: "beginner",
  estimatedHours: 7,
  parameters: [
    { key: "length", label: "Length", value: 42, min: 24, max: 60, step: 0.5, kind: "length" },
    { key: "depth", label: "Depth", value: 16, min: 12, max: 22, step: 0.5, kind: "length" },
    { key: "height", label: "Seat height", value: 18, min: 14, max: 22, step: 0.25, kind: "length" },
  ],
  derived: [
    { key: "t", expr: 0.75 },
    { key: "wallH", expr: "height - 2*t" },
  ],
  materials: [{ id: "ply", stock: "ply-3/4" }],
  components: [
    { id: "A1", name: "Bottom", material: "ply", grain: "x", size: { x: "length", y: "depth", z: "t" }, positions: [{ x: 0, y: 0, z: 0 }] },
    { id: "B1", name: "Front / back panel", material: "ply", grain: "x", size: { x: "length", y: "t", z: "wallH" }, positions: [{ x: 0, y: 0, z: "t" }, { x: 0, y: "depth - t", z: "t" }] },
    { id: "B2", name: "End panel", material: "ply", grain: "z", size: { x: "t", y: "depth - 2*t", z: "wallH" }, positions: [{ x: 0, y: "t", z: "t" }, { x: "length - t", y: "t", z: "t" }] },
    { id: "B3", name: "Center divider", material: "ply", grain: "z", size: { x: "t", y: "depth - 2*t", z: "wallH" }, positions: [{ x: "length/2 - t/2", y: "t", z: "t" }] },
    { id: "C1", name: "Lid", material: "ply", grain: "x", size: { x: "length", y: "depth", z: "t" }, positions: [{ x: 0, y: 0, z: "height - t" }], notes: ["Round over the front edge for comfort"] },
  ],
  joints: [
    { a: "A1", b: "B1", type: "butt-screw", hardware: "screws" },
    { a: "A1", b: "B2", type: "butt-screw", hardware: "screws" },
    { a: "A1", b: "B3", type: "butt-screw", hardware: "screws" },
    { a: "B1", b: "B2", type: "butt-screw", hardware: "screws" },
    { a: "B1", b: "B3", type: "butt-screw", hardware: "screws" },
    { a: "B1", b: "C1", type: "hinge", hardware: "hinges" },
  ],
  hardware: [
    { id: "screws", stock: "screw-1-5/8", quantity: 44, usage: "Box assembly" },
    { id: "hinges", stock: "hinge-butt", quantity: 3, usage: "Lid to back panel" },
    { id: "stays", stock: "lid-stay", quantity: 2, usage: "Soft-close lid supports" },
  ],
  supplies: [
    { stock: "wood-glue", quantity: 1, usage: "Box joints" },
    { stock: "wood-filler", quantity: 1, usage: "Screw holes and plywood edges" },
    { stock: "sandpaper-kit", quantity: 1, usage: "Surface prep" },
    { stock: "primer", quantity: 1, usage: "Paint prep" },
    { stock: "paint", quantity: 1, usage: "Finish color" },
  ],
  tools: [
    { tool: "tape-measure", essential: true, reason: "Measure every part." },
    { tool: "speed-square", essential: true, reason: "Mark square lines." },
    { tool: "circular-saw", essential: true, reason: "Break down the plywood sheet." },
    { tool: "clamps", essential: true, reason: "Clamp a straightedge guide and hold panels during assembly." },
    { tool: "drill", essential: true, reason: "Pilot holes and screws." },
    { tool: "screwdriver", essential: true, reason: "Install hinge and lid-stay screws." },
    { tool: "orbital-sander", essential: false, reason: "Smooth edges before painting." },
    ...SAFETY_TOOLS,
  ],
  steps: [
    { title: "Break down the plywood", description: "Cut the plywood into the six panels using a clamped straightedge as a saw guide. Use the cut diagram to minimize waste.", tools: ["circular-saw", "clamps", "tape-measure", "safety-glasses", "hearing-protection"], warnings: ["Support the whole sheet on foam insulation board or 2x4s so neither side falls when the cut finishes."], techniques: ["rip-cuts", "crosscuts"] },
    { title: "Attach the front and back to the bottom", description: "Glue and screw the front and back panels on top of the bottom panel, flush with its edges.", components: ["A1", "B1"], tools: ["drill", "clamps"], hardware: [{ id: "screws", quantity: 16 }], techniques: ["butt-joints", "drilling"] },
    { title: "Add the ends and the divider", description: "Fit the end panels between the front and back, and the divider in the middle. Screw through the front, back and bottom into each.", components: ["B2", "B3"], tools: ["drill", "speed-square"], hardware: [{ id: "screws", quantity: 28 }], tips: ["The divider supports the middle of the seat — don't skip it."] },
    { title: "Hinge the lid", description: "Set the lid on top with even overhang. Install three hinges along the back edge, then mount the two lid stays on the inside of the end panels.", components: ["C1"], tools: ["screwdriver", "drill"], hardware: [{ id: "hinges", quantity: 3 }, { id: "stays", quantity: 2 }], warnings: ["Lid stays are essential if children will use the bench — a falling lid can injure fingers."] },
    { title: "Fill, sand and paint", description: "Fill screw holes and exposed plywood edges, sand smooth, prime and paint two coats.", tools: ["orbital-sander"], warnings: ["Wear a dust mask when sanding filler and plywood."], techniques: ["sanding", "finishing"] },
  ],
  assumptions: ["Indoor use", "Seating for two adults with the center divider in place (not engineering-verified)"],
};

const desk: ProjectSpecInput = {
  schemaVersion: 1,
  name: "Gaming Desk with Cable Tray",
  summary: "A rigid 2x4-framed desk with a 3/4\" plywood top and an integrated rear cable-management tray.",
  style: "Industrial modern",
  units: "in",
  difficulty: "beginner",
  estimatedHours: 8,
  parameters: [
    { key: "width", label: "Width", value: 48, min: 36, max: 72, step: 0.5, kind: "length" },
    { key: "depth", label: "Depth", value: 24, min: 20, max: 32, step: 0.5, kind: "length" },
    { key: "height", label: "Height", value: 29.5, min: 26, max: 32, step: 0.25, kind: "length", description: "Standard sitting desks are 28–30\"" },
  ],
  derived: [
    { key: "t", expr: 0.75 },
    { key: "o", expr: 2, description: "Top overhang" },
    { key: "legH", expr: "height - t" },
    { key: "railY", expr: "depth - 2*o - 7" },
    { key: "spanX", expr: "width - 2*o - 3" },
    { key: "backY", expr: "depth - o - 1.5" },
  ],
  materials: [
    { id: "frame", stock: "spf-2x4" },
    { id: "top", stock: "ply-3/4" },
    { id: "tray", stock: "ply-1/2" },
  ],
  components: [
    { id: "A1", name: "Leg", material: "frame", grain: "z", size: { x: 1.5, y: 3.5, z: "legH" }, positions: [{ x: "o", y: "o", z: 0 }, { x: "width - o - 1.5", y: "o", z: 0 }, { x: "o", y: "depth - o - 3.5", z: 0 }, { x: "width - o - 1.5", y: "depth - o - 3.5", z: 0 }] },
    { id: "B1", name: "Upper side rail", material: "frame", grain: "y", size: { x: 1.5, y: "railY", z: 3.5 }, positions: [{ x: "o", y: "o + 3.5", z: "legH - 3.5" }, { x: "width - o - 1.5", y: "o + 3.5", z: "legH - 3.5" }] },
    { id: "B2", name: "Lower side rail", material: "frame", grain: "y", size: { x: 1.5, y: "railY", z: 3.5 }, positions: [{ x: "o", y: "o + 3.5", z: 5 }, { x: "width - o - 1.5", y: "o + 3.5", z: 5 }] },
    { id: "C1", name: "Upper back stretcher", material: "frame", grain: "x", size: { x: "spanX", y: 1.5, z: 3.5 }, positions: [{ x: "o + 1.5", y: "backY", z: "legH - 3.5" }] },
    { id: "C2", name: "Lower back stretcher", material: "frame", grain: "x", size: { x: "spanX", y: 1.5, z: 3.5 }, positions: [{ x: "o + 1.5", y: "backY", z: 5 }] },
    { id: "D1", name: "Cable tray bottom", material: "tray", grain: "x", size: { x: "spanX", y: 5.5, z: 0.5 }, positions: [{ x: "o + 1.5", y: "depth - o - 5.5", z: "legH - 4" }] },
    { id: "D2", name: "Cable tray lip", material: "tray", grain: "x", size: { x: "spanX", y: 0.5, z: 3 }, positions: [{ x: "o + 1.5", y: "depth - o - 5.5", z: "legH - 3.5" }] },
    { id: "E1", name: "Desktop", material: "top", grain: "x", size: { x: "width", y: "depth", z: "t" }, positions: [{ x: 0, y: 0, z: "legH" }], notes: ["Round over or sand the front edge for wrist comfort"] },
  ],
  joints: [
    { a: "A1", b: "B1", type: "pocket-hole", hardware: "pocket" },
    { a: "A1", b: "B2", type: "pocket-hole", hardware: "pocket" },
    { a: "A1", b: "C1", type: "pocket-hole", hardware: "pocket" },
    { a: "A1", b: "C2", type: "pocket-hole", hardware: "pocket" },
    { a: "C1", b: "D1", type: "butt-screw", hardware: "screws" },
    { a: "D1", b: "D2", type: "butt-screw", hardware: "screws" },
    { a: "B1", b: "E1", type: "bracket", hardware: "fasteners" },
  ],
  hardware: [
    { id: "pocket", stock: "pocket-2-1/2", quantity: 16, usage: "Frame joints" },
    { id: "screws", stock: "screw-1-1/4", quantity: "ceil(spanX / 8) * 2", usage: "Cable tray" },
    { id: "fasteners", stock: "desktop-fastener", quantity: 6, usage: "Attach the top (allows wood movement)" },
    { id: "fastenerScrews", stock: "screw-1-1/4", quantity: 12, usage: "Desktop fasteners" },
  ],
  supplies: [
    { stock: "wood-glue", quantity: 1, usage: "Frame joints" },
    { stock: "sandpaper-kit", quantity: 1, usage: "Surface prep" },
    { stock: "polyurethane", quantity: 1, usage: "Desktop protection" },
  ],
  tools: [
    { tool: "tape-measure", essential: true, reason: "Measure every part." },
    { tool: "speed-square", essential: true, reason: "Square cuts and frame corners." },
    { tool: "circular-saw", essential: true, reason: "Cut 2x4s and trim the plywood." },
    { tool: "drill", essential: true, reason: "Pocket holes, pilot holes and screws." },
    { tool: "pocket-hole-jig", essential: true, reason: "Strong hidden frame joints." },
    { tool: "chisel", essential: false, reason: "Recess desktop fasteners flush." },
    { tool: "clamps", essential: true, reason: "Hold frame joints flush." },
    { tool: "orbital-sander", essential: false, reason: "Smooth the desktop." },
    ...SAFETY_TOOLS,
  ],
  steps: [
    { title: "Cut the frame and top", description: "Cut the legs, rails and stretchers from 2x4s; cut the desktop and tray parts from plywood.", tools: ["tape-measure", "speed-square", "circular-saw", "safety-glasses", "hearing-protection"], techniques: ["crosscuts", "rip-cuts"] },
    { title: "Build two leg frames", description: "Pocket-screw an upper and a lower side rail between each front/back leg pair, flush with the outside faces.", components: ["A1", "B1", "B2"], tools: ["pocket-hole-jig", "drill", "clamps", "speed-square"], hardware: [{ id: "pocket", quantity: 8 }], techniques: ["pocket-holes"] },
    { title: "Connect the frames", description: "Join the two leg frames with the upper and lower back stretchers, flush with the back faces of the legs.", components: ["C1", "C2"], tools: ["drill", "clamps"], hardware: [{ id: "pocket", quantity: 8 }], tips: ["Measure the diagonals of the frame: equal diagonals mean it's square."], techniques: ["squaring"] },
    { title: "Add the cable tray", description: "Screw the tray bottom up into the underside of the upper back stretcher, then glue and screw the lip to the front edge of the tray bottom.", components: ["D1", "D2"], tools: ["drill"], hardware: [{ id: "screws", quantity: "ceil(spanX / 8) * 2" }] },
    { title: "Attach the desktop", description: "Install the figure-8 fasteners on top of the side rails, then center the desktop and screw it down from below.", components: ["E1"], tools: ["drill", "chisel"], hardware: [{ id: "fasteners", quantity: 6 }, { id: "fastenerScrews", quantity: 12 }], techniques: ["wood-movement"] },
    { title: "Sand and finish", description: "Sand the desktop to 220 grit and apply three coats of polyurethane.", tools: ["orbital-sander"], techniques: ["sanding", "finishing"] },
  ],
  assumptions: ["Indoor use", "Typical computer/monitor loads"],
};

const floatingShelf: ProjectSpecInput = {
  schemaVersion: 1,
  name: "Floating Shelf",
  summary: "A chunky solid-wood floating shelf that slides onto a hidden steel bracket screwed into wall studs.",
  style: "Minimalist",
  units: "in",
  difficulty: "complete-beginner",
  estimatedHours: 3,
  parameters: [
    { key: "length", label: "Length", value: 24, min: 12, max: 48, step: 0.5, kind: "length" },
    { key: "mountHeight", label: "Height above floor", value: 48, min: 12, max: 84, step: 0.5, kind: "length" },
  ],
  derived: [],
  materials: [{ id: "shelf", stock: "spf-2x8" }],
  components: [
    { id: "A1", name: "Shelf board", material: "shelf", grain: "x", size: { x: "length", y: 7.25, z: 1.5 }, positions: [{ x: 0, y: 0, z: "mountHeight" }], drilling: ["Holes in the back edge matching the bracket rods (size and spacing from the bracket instructions)"] },
  ],
  joints: [],
  hardware: [{ id: "bracket", stock: "floating-bracket", quantity: "ceil(length / 24)", usage: "Hidden wall bracket" }],
  supplies: [
    { stock: "sandpaper-kit", quantity: 1, usage: "Surface prep" },
    { stock: "stain", quantity: 1, usage: "Color" },
    { stock: "polyurethane", quantity: 1, usage: "Protection" },
  ],
  tools: [
    { tool: "tape-measure", essential: true, reason: "Measure and mark." },
    { tool: "hand-saw", essential: false, reason: "One crosscut — a hand saw is fine." },
    { tool: "drill", essential: true, reason: "Drill rod holes and drive bracket screws." },
    { tool: "stud-finder", essential: true, reason: "The bracket must go into studs." },
    { tool: "level", essential: true, reason: "Keep the shelf level." },
    { tool: "sanding-block", essential: true, reason: "Ease the edges and smooth the faces." },
    { tool: "safety-glasses", essential: true, reason: "Eye protection." },
  ],
  steps: [
    { title: "Cut the board", description: "Choose a straight, dry 2x8 and cut it to length, trimming off any end checks.", tools: ["tape-measure", "hand-saw", "safety-glasses"], techniques: ["crosscuts"] },
    { title: "Drill the rod holes", description: "Hold the bracket against the back edge, mark each rod, and drill straight holes to the depth the bracket needs.", components: ["A1"], tools: ["drill", "tape-measure"], tips: ["Wrap tape on the bit as a depth stop.", "Drill 1/16\" oversize so the shelf slides on easily."], techniques: ["drilling"] },
    { title: "Sand and finish", description: "Round the edges slightly, sand to 180 grit, then stain and seal.", tools: ["sanding-block"], techniques: ["sanding", "finishing"] },
    { title: "Mount the bracket", description: "Find the studs, level the bracket at the mounting height, and screw it into at least two studs.", tools: ["stud-finder", "level", "drill"], hardware: [{ id: "bracket", quantity: "ceil(length / 24)" }], warnings: ["Never mount a floating shelf to drywall alone.", "Check for wires and pipes before drilling."] },
    { title: "Slide on the shelf", description: "Slide the shelf over the rods until it's tight to the wall.", tools: [] },
  ],
  assumptions: ["Wall-mounted into wood studs", "Light decorative loads — follow the bracket's rated capacity"],
};

export type Template = { key: string; spec: ProjectSpec; keywords: RegExp; blurb: string };

export const TEMPLATES: Template[] = [
  { key: "bookshelf", spec: ProjectSpec.parse(bookshelf), keywords: /book ?(shel|case)|shelving unit|shelves/i, blurb: "A sturdy first furniture project" },
  { key: "coffee-table", spec: ProjectSpec.parse(coffeeTable), keywords: /coffee table|farmhouse table|living room table|table/i, blurb: "Pocket holes + a plank top" },
  { key: "storage-bench", spec: ProjectSpec.parse(storageBench), keywords: /bench|toy box|chest|storage box|hinged lid/i, blurb: "Plywood box with a hinged lid" },
  { key: "desk", spec: ProjectSpec.parse(desk), keywords: /desk|workstation|computer table/i, blurb: "2x4 frame with a cable tray" },
  { key: "floating-shelf", spec: ProjectSpec.parse(floatingShelf), keywords: /floating|wall shelf|^\s*shelf\b/i, blurb: "The perfect first project" },
];

/** Best template for a free-text idea (offline fallback). */
export function matchTemplate(prompt: string): Template | undefined {
  // Most specific first: "floating bookshelf" should match floating-shelf.
  const order = ["floating-shelf", "bookshelf", "storage-bench", "desk", "coffee-table"];
  for (const key of order) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    if (t.keywords.test(prompt)) return t;
  }
  return undefined;
}
