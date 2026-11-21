/**
 * Tool library: what each tool does, how to use it, safety, and which
 * other tools can do the same job (used by "I don't have a table saw").
 */
export type ToolInfo = {
  key: string;
  name: string;
  category: "measuring" | "cutting" | "drilling" | "shaping" | "sanding" | "clamping" | "assembly" | "safety";
  power: boolean;
  description: string;
  howTo: string[];
  safety: string[];
  /** Tools that can substitute, with how. */
  alternatives: { tool: string; how: string }[];
  /** Rough price for a decent entry-level version. */
  approxPrice: number;
};

const T: ToolInfo[] = [
  {
    key: "tape-measure", name: "Tape measure", category: "measuring", power: false, approxPrice: 15,
    description: "Measures length. The hook at the end slides by its own thickness so inside and outside measurements are both accurate.",
    howTo: ["Hook the end over the board edge, pull the tape flat, read at the mark.", "For precision, 'burn an inch': measure from the 1\" mark and subtract 1\"."],
    safety: ["Let the tape retract slowly — the blade edge can cut fingers."],
    alternatives: [{ tool: "steel-rule", how: "Use a steel rule for anything under 24\"." }],
  },
  {
    key: "speed-square", name: "Speed square", category: "measuring", power: false, approxPrice: 10,
    description: "A triangular square for marking 90° and 45° lines, and a saw guide for straight crosscuts.",
    howTo: ["Press the lipped fence against the board edge.", "Draw along the edge for a square line.", "Hold firmly and run a circular saw's base plate along it as a fence."],
    safety: ["Keep fingers on the top of the square, away from the saw path."],
    alternatives: [{ tool: "combination-square", how: "A combination square marks 90° and 45° too." }],
  },
  {
    key: "combination-square", name: "Combination square", category: "measuring", power: false, approxPrice: 20,
    description: "Adjustable ruler + head for marking square lines, consistent offsets, and checking assemblies for square.",
    howTo: ["Lock the ruler at the offset you need and slide the head along the edge with a pencil at the end of the ruler."],
    safety: [],
    alternatives: [{ tool: "speed-square", how: "For simple 90° lines." }],
  },
  {
    key: "steel-rule", name: "Steel rule", category: "measuring", power: false, approxPrice: 10,
    description: "A flat, rigid ruler for accurate short measurements and a straightedge for marking.", howTo: ["Stand it on edge so the marks touch the wood for the most accurate reading."], safety: [], alternatives: [{ tool: "tape-measure", how: "Less precise but fine for most cuts." }],
  },
  {
    key: "level", name: "Level", category: "measuring", power: false, approxPrice: 20,
    description: "Shows whether a surface is perfectly horizontal (level) or vertical (plumb) using a bubble vial.",
    howTo: ["Place on the surface; the bubble centered between the lines means level.", "Flip it end-for-end and check again to confirm the level itself is accurate."],
    safety: [],
    alternatives: [{ tool: "phone-level", how: "A phone level app works for rough checks." }],
  },
  {
    key: "stud-finder", name: "Stud finder", category: "measuring", power: true, approxPrice: 25,
    description: "Locates wooden studs (and sometimes wires/pipes) behind drywall so wall-mounted projects are anchored securely.",
    howTo: ["Calibrate on the wall, slide slowly horizontally, mark both edges of the stud, and drive fasteners through the center.", "Confirm with a small finish nail in an area that will be hidden."],
    safety: ["Never drill where the finder or common sense says there may be wiring — directly above/below outlets and switches."],
    alternatives: [{ tool: "magnet", how: "A strong magnet finds the drywall screws in each stud." }],
  },
  {
    key: "circular-saw", name: "Circular saw", category: "cutting", power: true, approxPrice: 70,
    description: "A handheld spinning-blade saw for straight crosscuts and rip cuts in boards and plywood.",
    howTo: ["Set the blade depth about 1/4\" below the material.", "Support both sides of the cut so the offcut doesn't pinch the blade.", "Clamp a straightedge or speed square as a guide and let the saw reach full speed before cutting."],
    safety: ["Wear eye and hearing protection.", "Kickback happens when the blade pinches — support the work and never stand directly behind the saw.", "Keep the blade guard working; never pin it back.", "Unplug or remove the battery before changing blades."],
    alternatives: [
      { tool: "jigsaw", how: "Slower and less straight; clamp a guide and sand the edge." },
      { tool: "hand-saw", how: "Fine for a few crosscuts in boards." },
      { tool: "store-cuts", how: "Many lumber stores will make rough plywood cuts for you." },
    ],
  },
  {
    key: "miter-saw", name: "Miter saw", category: "cutting", power: true, approxPrice: 180,
    description: "A chop saw that makes fast, accurate crosscuts and angled (miter) cuts on boards.",
    howTo: ["Hold the board firmly against the fence.", "Let the blade reach full speed, lower it smoothly, and let it stop before raising.", "Use a stop block for many identical lengths."],
    safety: ["Keep hands at least 6\" from the blade (most saws mark a no-hands zone).", "Never cross your arms or reach behind the blade.", "Don't cut pieces too short to hold safely — cut them from a longer board."],
    alternatives: [
      { tool: "circular-saw", how: "Clamp a speed square as a guide for each crosscut." },
      { tool: "hand-saw", how: "Use a miter box for accurate angles." },
    ],
  },
  {
    key: "table-saw", name: "Table saw", category: "cutting", power: true, approxPrice: 400,
    description: "A stationary saw with the blade through a table — the most accurate tool for rip cuts (cutting boards to width).",
    howTo: ["Set the fence to the width you want, measured from the blade tooth.", "Set the blade about 1/8\" above the wood.", "Use a push stick for the last 6\" of every narrow cut."],
    safety: ["Always use the riving knife and blade guard.", "Never cut freehand — use the fence or miter gauge, never both together.", "Stand slightly to the side of the blade line to stay out of the kickback path.", "Beginners should get hands-on instruction before using a table saw."],
    alternatives: [
      { tool: "circular-saw", how: "Clamp a straightedge (or use a track/rip guide) to rip boards." },
      { tool: "buy-to-width", how: "Pick a stock board width that matches the part to avoid ripping." },
    ],
  },
  {
    key: "jigsaw", name: "Jigsaw", category: "cutting", power: true, approxPrice: 60,
    description: "A reciprocating-blade saw for curves, notches and cut-outs.",
    howTo: ["Clamp the work, keep the shoe flat on the surface, and let the blade do the work — don't force it."],
    safety: ["The blade sticks out below the work — keep clear of it and your bench.", "Wait for the blade to stop before lifting it out of the cut."],
    alternatives: [{ tool: "coping-saw", how: "A coping saw cuts small curves by hand." }],
  },
  {
    key: "hand-saw", name: "Hand saw", category: "cutting", power: false, approxPrice: 25,
    description: "A manual saw for crosscuts; Japanese pull saws are especially easy for beginners.", howTo: ["Start the cut with a few light pull strokes on the waste side of the line, then use long, relaxed strokes."], safety: ["Keep your free hand well away from the start of the cut."], alternatives: [{ tool: "circular-saw", how: "Faster for many cuts." }],
  },
  {
    key: "drill", name: "Drill / driver", category: "drilling", power: true, approxPrice: 90,
    description: "Drills holes and drives screws. A cordless drill is the single most useful tool for DIY.",
    howTo: ["Use the clutch (numbered collar) to keep from over-driving screws.", "Drill pilot holes in hardwood and near board ends to prevent splitting.", "Countersink so screw heads sit flush."],
    safety: ["Clamp small pieces — a catching bit can spin the work.", "Wear eye protection when drilling."],
    alternatives: [{ tool: "impact-driver", how: "Drives screws faster; still need a drill for precise holes." }],
  },
  {
    key: "impact-driver", name: "Impact driver", category: "drilling", power: true, approxPrice: 100,
    description: "Drives long screws and lag screws with much more torque than a drill.", howTo: ["Use hex-shank bits. Ease off as the screw seats so it doesn't sink too deep."], safety: ["Very loud — wear hearing protection."], alternatives: [{ tool: "drill", how: "A drill can drive most screws; pre-drill pilots for long ones." }],
  },
  {
    key: "pocket-hole-jig", name: "Pocket-hole jig", category: "drilling", power: false, approxPrice: 40,
    description: "Guides a stepped bit to drill angled holes so screws can join boards from hidden faces. Strong, fast, beginner-friendly joinery.",
    howTo: ["Set the jig and drill collar for your board thickness (usually 3/4\").", "Clamp the jig, drill, then clamp the joint flat and drive pocket screws.", "Hide pockets on the underside or back."],
    safety: ["Clamp the jig — never hold it by hand while drilling."],
    alternatives: [
      { tool: "drill", how: "Use glue + countersunk screws through the face, then fill the holes." },
      { tool: "dowel-jig", how: "Dowels give a hidden joint without special screws." },
    ],
  },
  {
    key: "dowel-jig", name: "Doweling jig", category: "drilling", power: false, approxPrice: 35,
    description: "Guides a drill bit to make matching holes for dowel joints.", howTo: ["Mark both pieces together, clamp the jig at each mark, and drill to depth using a stop collar."], safety: ["Clamp the work."], alternatives: [{ tool: "pocket-hole-jig", how: "Faster, but screws show on one face." }],
  },
  {
    key: "router", name: "Router", category: "shaping", power: true, approxPrice: 130,
    description: "Spins shaped bits to round edges, cut dados/rabbets, and make decorative profiles.",
    howTo: ["Move the router left-to-right along an edge (against the bit rotation).", "Take several shallow passes rather than one deep one."],
    safety: ["Wear eye and hearing protection.", "Unplug before changing bits.", "Clamp the work securely."],
    alternatives: [
      { tool: "orbital-sander", how: "Sand a gentle round-over instead of routing it." },
      { tool: "circular-saw", how: "Several passes at partial depth can cut a dado; clean up with a chisel." },
    ],
  },
  {
    key: "chisel", name: "Chisels", category: "shaping", power: false, approxPrice: 30,
    description: "Sharp blades for paring joints, cleaning dados, and fitting hinges.", howTo: ["Keep chisels sharp; push away from your body; take thin shavings."], safety: ["Always keep both hands behind the cutting edge."], alternatives: [{ tool: "router", how: "Hinge mortises can be routed." }],
  },
  {
    key: "orbital-sander", name: "Random orbital sander", category: "sanding", power: true, approxPrice: 70,
    description: "Sands flat surfaces quickly with minimal swirl marks.",
    howTo: ["Progress through grits (120 → 180 → 220).", "Keep it flat and moving slowly; let its weight do the work."],
    safety: ["Wear a dust mask or respirator; connect a vacuum if possible."],
    alternatives: [{ tool: "sanding-block", how: "Hand sand with a block — slower but excellent results." }],
  },
  {
    key: "sanding-block", name: "Sanding block", category: "sanding", power: false, approxPrice: 8, description: "A firm block that holds sandpaper flat for even hand sanding.", howTo: ["Sand with the grain."], safety: ["Wear a dust mask."], alternatives: [{ tool: "orbital-sander", how: "Much faster on large surfaces." }],
  },
  {
    key: "clamps", name: "Clamps", category: "clamping", power: false, approxPrice: 40,
    description: "Hold parts together while glue dries or while you drill and drive screws. You can never have too many.",
    howTo: ["Use cauls or scrap pads to protect the wood.", "Tighten until glue squeezes out in small beads — not as hard as possible."],
    safety: ["Don't over-tighten cheap clamps; they can snap."],
    alternatives: [{ tool: "ratchet-strap", how: "A ratchet strap can clamp large frames." }],
  },
  {
    key: "hammer", name: "Hammer", category: "assembly", power: false, approxPrice: 20, description: "Drives nails and taps joints together (use a scrap block to protect the surface).", howTo: ["Grip near the end of the handle and let the weight do the work."], safety: ["Wear eye protection."], alternatives: [{ tool: "mallet", how: "A rubber mallet taps joints together without dents." }],
  },
  {
    key: "brad-nailer", name: "Brad nailer", category: "assembly", power: true, approxPrice: 120, description: "Shoots thin nails to hold parts while glue dries, and attaches back panels and trim.", howTo: ["Hold flat and square to the surface; adjust depth so heads sit just below the surface."], safety: ["Never point at anyone. Keep fingers away from the nose — nails can deflect off knots."], alternatives: [{ tool: "hammer", how: "Hand-drive panel nails or brads; pre-drill near edges." }],
  },
  {
    key: "screwdriver", name: "Screwdriver", category: "assembly", power: false, approxPrice: 10, description: "Hand tool for driving screws, useful for final tightening and hardware like hinges.", howTo: ["Match the bit to the screw head."], safety: [], alternatives: [{ tool: "drill", how: "Use the drill's lowest clutch setting." }],
  },
  {
    key: "safety-glasses", name: "Safety glasses", category: "safety", power: false, approxPrice: 8, description: "Protect your eyes from chips, dust and fragments. Wear them for every cut and every drilled hole.", howTo: ["Choose ANSI Z87.1-rated glasses that fit over prescription glasses if needed."], safety: [], alternatives: [],
  },
  {
    key: "hearing-protection", name: "Hearing protection", category: "safety", power: false, approxPrice: 15, description: "Earmuffs or plugs. Saws and routers are loud enough to cause permanent hearing damage.", howTo: [], safety: [], alternatives: [],
  },
  {
    key: "dust-mask", name: "Dust mask / respirator", category: "safety", power: false, approxPrice: 20, description: "Fine wood dust (especially MDF) is a respiratory hazard. Use an N95 or better.", howTo: [], safety: [], alternatives: [],
  },
];

export const TOOL_LIBRARY: Record<string, ToolInfo> = Object.fromEntries(T.map((t) => [t.key, t]));

/** Pseudo-tools used only as alternative methods. */
export const ALT_METHOD_NAMES: Record<string, string> = {
  "store-cuts": "Have the store cut it",
  "buy-to-width": "Buy stock at the right width",
  "phone-level": "Phone level app",
  magnet: "Strong magnet",
  "ratchet-strap": "Ratchet strap",
  "coping-saw": "Coping saw",
  mallet: "Rubber mallet",
};

export const toolName = (key: string) => TOOL_LIBRARY[key]?.name ?? ALT_METHOD_NAMES[key] ?? key;

/**
 * Given the project's tools and what the user owns, return missing tools and
 * any substitutes the user already has.
 */
export function substituteTools(required: string[], owned: Set<string>) {
  return required
    .filter((t) => !owned.has(t))
    .map((t) => {
      const info = TOOL_LIBRARY[t];
      const options = info?.alternatives ?? [];
      return {
        tool: t,
        ownedAlternatives: options.filter((o) => owned.has(o.tool) || ALT_METHOD_NAMES[o.tool]),
        allAlternatives: options,
      };
    });
}
