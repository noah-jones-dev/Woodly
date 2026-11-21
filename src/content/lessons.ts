/**
 * Learn-as-you-build lessons. Instruction steps reference these by key
 * (`techniques: ["pocket-holes"]`), so a step can link straight to the
 * lesson that teaches it.
 */
export type LessonCategory = "fundamentals" | "cutting" | "joinery" | "home" | "safety";

export type Lesson = {
  key: string;
  title: string;
  category: LessonCategory;
  level: "complete-beginner" | "beginner" | "intermediate" | "advanced";
  minutes: number;
  summary: string;
  sections: { heading: string; body: string }[];
  tools: string[];
  mistakes: string[];
  safety: string[];
  exercise: string;
  /** Which built-in diagram to show (see LessonDiagram). */
  diagram?: "grain" | "butt" | "pocket" | "dado" | "rabbet" | "mortise" | "dovetail" | "dowel" | "rip-cross" | "miter-bevel" | "square";
};

export const CATEGORY_LABELS: Record<LessonCategory, string> = {
  safety: "Shop Safety",
  fundamentals: "Woodworking Fundamentals",
  cutting: "Cutting & Shaping",
  joinery: "Joinery",
  home: "Home Improvement",
};

export const LESSONS: Lesson[] = [
  {
    key: "shop-safety", title: "Power tool safety basics", category: "safety", level: "complete-beginner", minutes: 8,
    summary: "The habits that keep all ten fingers attached: protective gear, kickback, and a safe workspace.",
    sections: [
      { heading: "Personal protective equipment", body: "Wear safety glasses for every cut, drilled hole and hammer strike. Use hearing protection with saws and routers. Wear an N95 or better mask when sanding or cutting MDF. Avoid loose sleeves, gloves near spinning blades, and dangling jewelry." },
      { heading: "What is kickback?", body: "Kickback is when a spinning blade grabs the wood and throws it (or the saw) back toward you. It happens when the blade gets pinched or twisted in the cut. Support your work so the cut opens rather than closes, keep the riving knife and guard installed, and stand to the side of the blade's path." },
      { heading: "A safe workspace", body: "Keep the floor clear of offcuts and cords, light the area well, clamp your work instead of holding it, and unplug tools (or remove batteries) before changing blades or bits. Never work when tired or rushed." },
    ],
    tools: ["safety-glasses", "hearing-protection", "dust-mask", "clamps"],
    mistakes: ["Removing the blade guard because it 'gets in the way'", "Holding small pieces by hand near a blade", "Reaching over a spinning blade"],
    safety: ["Never bypass a tool's safety mechanism.", "If a cut feels unsafe, stop and find another way — there always is one."],
    exercise: "Walk through your workspace and fix three hazards: cords, clutter, and lighting.",
  },
  {
    key: "understanding-lumber", title: "Understanding lumber", category: "fundamentals", level: "complete-beginner", minutes: 7,
    summary: "Why a 2x4 isn't 2\" x 4\", how boards and plywood are sold, and how to pick good boards.",
    sections: [
      { heading: "Nominal vs. actual sizes", body: "Lumber is named by its rough-sawn size before drying and planing. A '1x' board is actually 3/4\" thick, a '2x' is 1-1/2\". Widths shrink too: a 1x4 is 3-1/2\" wide, a 1x6 is 5-1/2\", a 1x12 is 11-1/4\". Woodly always uses actual sizes in blueprints." },
      { heading: "Sheet goods", body: "Plywood and MDF come in 4' x 8' sheets. Plywood is layers of veneer glued with alternating grain — stable and strong. MDF is smooth and paints well but is heavy, sags, and hates water." },
      { heading: "Picking good boards", body: "Sight down each board's edge. Avoid boards that bow, twist or cup, have large loose knots, or cracks (checks) at the ends. It's normal to dig through the pile." },
    ],
    tools: ["tape-measure"],
    mistakes: ["Designing with nominal sizes", "Buying the top board without checking it"],
    safety: ["Lift sheet goods with a partner or a panel carrier."],
    exercise: "At the store, measure a 2x4 and a 1x6 and note the real dimensions.",
  },
  {
    key: "hardwood-softwood", title: "Hardwood vs. softwood", category: "fundamentals", level: "complete-beginner", minutes: 5,
    summary: "What the names really mean, and which to choose for your project.",
    sections: [
      { heading: "The difference", body: "Softwoods (pine, fir, cedar) come from conifers; hardwoods (oak, maple, walnut, poplar) from broadleaf trees. Most softwoods are softer and cheaper, but the names describe the tree, not the hardness — balsa is a 'hardwood'." },
      { heading: "Choosing", body: "Pine: cheap, easy to cut, dents easily, can stain blotchy. Poplar: smooth, great for painted furniture. Oak: strong, beautiful grain, harder to cut and more expensive. Cedar: naturally rot resistant for outdoor projects." },
    ],
    tools: [], mistakes: ["Using untreated pine outdoors without a finish"], safety: ["Wear a mask with cedar and exotic woods; some cause allergic reactions."],
    exercise: "Press your fingernail into pine and oak scraps to feel the difference.",
  },
  {
    key: "measuring-marking", title: "Measuring and marking", category: "fundamentals", level: "complete-beginner", minutes: 6,
    summary: "Measure twice, cut once — and mark so your cuts land exactly where you want them.",
    sections: [
      { heading: "Read the tape", body: "Each inch is divided into 16ths. The longest marks are 1/2\", then 1/4\", 1/8\" and 1/16\". Woodly shows measurements as fractions like 28-1/2\" to match your tape." },
      { heading: "Mark with a V", body: "Instead of a dash, mark a small 'V' whose point sits exactly on the measurement. Then use a square to draw your cut line through the point." },
      { heading: "Cut on the waste side", body: "A saw blade removes about 1/8\" (the kerf). Put an X on the waste piece and cut on that side of the line so your part stays full size." },
    ],
    tools: ["tape-measure", "speed-square", "combination-square"],
    mistakes: ["Cutting down the middle of the line", "Measuring each part from the previous cut instead of the cut list"],
    safety: [],
    exercise: "Mark and cut three pieces to exactly 12\". Measure them — they should match within 1/32\".",
    diagram: "square",
  },
  {
    key: "grain-direction", title: "Understanding grain direction", category: "fundamentals", level: "beginner", minutes: 5,
    summary: "Wood is strongest along its grain. Here's why it matters for strength, cutting, and looks.",
    sections: [
      { heading: "Long grain vs. end grain", body: "Grain runs the length of a board like a bundle of straws. Boards are strong along the grain and weak across it. End grain soaks up glue and stain and holds screws poorly." },
      { heading: "In your design", body: "Woodly's blueprints mark each part's grain direction. Long, thin parts should always run with the grain; for plywood, keep the face grain running the long way of visible parts." },
    ],
    tools: [], mistakes: ["Gluing end grain and expecting it to hold"], safety: [], exercise: "Look at the end of a board and identify the growth rings.",
    diagram: "grain",
  },
  {
    key: "wood-movement", title: "Wood movement and moisture", category: "fundamentals", level: "beginner", minutes: 6,
    summary: "Wood swells and shrinks across its width with humidity. Designs must allow for it.",
    sections: [
      { heading: "How much?", body: "A 12\"-wide solid wood panel can change width by 1/8\" or more between summer and winter. Length barely changes." },
      { heading: "Designing for it", body: "Attach solid tops with fasteners that allow movement (figure-8 fasteners, Z-clips, or slotted holes). Don't glue planks into a rigid frame across the grain. Plywood barely moves, which is why it's used for panels." },
    ],
    tools: [], mistakes: ["Screwing a wide top down tightly — it may crack"], safety: [], exercise: "Find a solid-wood table at home and look underneath to see how the top is attached.",
  },
  {
    key: "sanding", title: "Sanding", category: "fundamentals", level: "complete-beginner", minutes: 5,
    summary: "Progress through grits, sand with the grain, and know when to stop.",
    sections: [
      { heading: "Grit progression", body: "Start at 120 to remove marks, then 180, then 220 for a smooth finish. Never skip more than one grit — the finer paper can't remove deep scratches from coarse paper." },
      { heading: "Technique", body: "Keep the sander flat and moving slowly. Let it do the work. Hand-sand the last pass with the grain. Wipe off dust between grits." },
    ],
    tools: ["orbital-sander", "sanding-block", "dust-mask"], mistakes: ["Pressing hard on the sander", "Rounding over edges you want crisp"], safety: ["Wear a mask; fine dust is harmful to lungs."], exercise: "Sand a scrap to 220 and compare it with an unsanded one under a raking light.",
  },
  {
    key: "finishing", title: "Staining and finishing", category: "fundamentals", level: "beginner", minutes: 8,
    summary: "Color with stain, protect with a top coat, and avoid blotches.",
    sections: [
      { heading: "Prep", body: "Sand to 180–220, remove all dust, and test the stain on a scrap from the same board. On pine, use a pre-stain conditioner to avoid blotches." },
      { heading: "Stain", body: "Wipe on, wait the recommended time, wipe off all excess with the grain. Darker color comes from a second coat, not leaving more on." },
      { heading: "Top coat", body: "Polyurethane protects against water and wear. Apply thin coats, lightly sand with 320 between coats, and apply 2–3 coats on tabletops." },
    ],
    tools: ["sanding-block"],
    mistakes: ["Skipping the test board", "Applying thick coats that drip"],
    safety: ["Oily rags can spontaneously combust — lay them flat outside to dry, or soak them in water in a sealed metal can.", "Work with good ventilation."],
    exercise: "Make a sample board with conditioner on one half and not the other.",
  },
  {
    key: "crosscuts", title: "Straight crosscuts", category: "cutting", level: "complete-beginner", minutes: 6,
    summary: "Cutting a board to length — the cut you'll make most often.",
    sections: [
      { heading: "What it is", body: "A crosscut goes across the grain to cut a board to length. A miter saw makes it fastest; a circular saw guided by a speed square works great." },
      { heading: "With a circular saw", body: "Mark the line, hold the speed square's lip against the board edge, line the blade up on the waste side, then slide the square against the saw's base plate. Start the saw, then push it through, keeping the plate against the square." },
    ],
    tools: ["circular-saw", "speed-square", "miter-saw"], mistakes: ["Letting the offcut fall and splinter the end"], safety: ["Support both sides so the blade doesn't pinch.", "Keep hands clear of the blade path."], exercise: "Make five crosscuts and check each with a square.",
    diagram: "rip-cross",
  },
  {
    key: "rip-cuts", title: "Rip cuts", category: "cutting", level: "beginner", minutes: 6,
    summary: "Cutting a board or sheet along its length to make it narrower.",
    sections: [
      { heading: "What it is", body: "A rip cut goes with the grain. Table saws are made for it. Without one, clamp a straight edge to the board as a guide for your circular saw." },
      { heading: "Avoiding rips", body: "Woodly tries to pick stock widths that match your parts so you don't have to rip at all — the cut list marks parts that need ripping." },
    ],
    tools: ["table-saw", "circular-saw", "clamps"], mistakes: ["Freehanding a long rip cut"], safety: ["Rip cuts are the most kickback-prone. Use a riving knife and push stick on a table saw."], exercise: "Rip a 1x6 to 4\" using a clamped guide.",
    diagram: "rip-cross",
  },
  {
    key: "miter-bevel", title: "Miter and bevel cuts", category: "cutting", level: "intermediate", minutes: 6,
    summary: "Angled cuts for frames, trim and corners.",
    sections: [
      { heading: "Miter vs. bevel", body: "A miter is angled across the face of the board (like a picture frame corner). A bevel is angled through the thickness. Compound cuts combine both." },
      { heading: "Accuracy", body: "Small errors multiply: in a four-corner frame, a 1° error per cut leaves an 8° gap. Test-cut on scrap first." },
    ],
    tools: ["miter-saw"], mistakes: ["Not test cutting on scrap"], safety: ["Let the blade stop before lifting it."], exercise: "Make a small picture frame from 1x2.",
    diagram: "miter-bevel",
  },
  {
    key: "drilling", title: "Drilling and driving screws", category: "cutting", level: "complete-beginner", minutes: 6,
    summary: "Pilot holes, countersinks, and how to avoid splitting the wood.",
    sections: [
      { heading: "Pilot holes", body: "A pilot hole is slightly smaller than the screw's core. It guides the screw and stops the wood from splitting, especially near ends and in hardwood." },
      { heading: "Countersinking", body: "A countersink bit cuts a cone so screw heads sit flush or below the surface, ready for filler." },
      { heading: "The clutch", body: "Set the drill's clutch so it slips when the screw is seated. Start low and increase." },
    ],
    tools: ["drill", "impact-driver"], mistakes: ["Screwing near an end without a pilot hole"], safety: ["Clamp small parts before drilling."], exercise: "Drive screws into scrap with and without pilot holes near the end to see the difference.",
  },
  {
    key: "routing", title: "Routing basics", category: "cutting", level: "intermediate", minutes: 8,
    summary: "Round-overs, chamfers and grooves with a router.",
    sections: [
      { heading: "Direction", body: "On an outside edge, move the router left to right (counter-clockwise around a panel) so the bit pulls itself into the wood, not away." },
      { heading: "Shallow passes", body: "Take several light passes. Deep single passes burn the wood and are harder to control." },
    ],
    tools: ["router", "clamps"], mistakes: ["Climb cutting (wrong direction)"], safety: ["Unplug before changing bits.", "Clamp the work."], exercise: "Round over the edges of a scrap board with a 1/4\" round-over bit.",
  },
  {
    key: "butt-joints", title: "Butt joints", category: "joinery", level: "complete-beginner", minutes: 5,
    summary: "The simplest joint: two boards meet and are glued and screwed.",
    sections: [
      { heading: "How it works", body: "One board's end or edge sits against another's face. Glue alone is weak on end grain, so screws or nails do the holding." },
      { heading: "Make it strong", body: "Use glue plus 2–3 screws per joint, pre-drill and countersink, and keep the joint square while you drive the screws." },
    ],
    tools: ["drill", "clamps"], mistakes: ["Relying on glue alone at end grain"], safety: [], exercise: "Build a simple box from 1x6 with butt joints.",
    diagram: "butt",
  },
  {
    key: "pocket-holes", title: "Pocket holes", category: "joinery", level: "beginner", minutes: 7,
    summary: "Angled screws hidden on the back side — strong, fast, and beginner-friendly.",
    sections: [
      { heading: "How it works", body: "A jig guides a stepped bit at about 15°, making a pocket for a screw that exits the board's end and bites into the next board." },
      { heading: "Step by step", body: "Set the jig and bit collar for your board thickness. Clamp the jig and drill. Clamp the two parts flat (a face clamp helps), then drive the pocket screws." },
      { heading: "Screw choice", body: "Coarse thread for softwood and plywood, fine thread for hardwood. 1-1/4\" screws for 3/4\" stock, 2-1/2\" for 1-1/2\" stock." },
    ],
    tools: ["pocket-hole-jig", "drill", "clamps"], mistakes: ["Parts shifting when the screw goes in — clamp them flat", "Pockets on a visible face"], safety: ["Clamp the jig; never hold it by hand while drilling."], exercise: "Join two 1x4s at a right angle with two pocket screws.",
    diagram: "pocket",
  },
  {
    key: "dado-rabbet", title: "Dados and rabbets", category: "joinery", level: "intermediate", minutes: 7,
    summary: "Grooves that capture shelves and backs — stronger and self-aligning.",
    sections: [
      { heading: "Dado", body: "A dado is a flat-bottomed groove across the grain. A shelf sitting in a 1/4\"-deep dado can't sag out of place and is much stronger than a butt joint." },
      { heading: "Rabbet", body: "A rabbet is a step cut along an edge. Cabinet backs sit in rabbets so they're hidden from the side." },
      { heading: "Cutting them", body: "Use a router with a straight bit and a clamped guide, or several passes with a circular saw set to depth, cleaned up with a chisel." },
    ],
    tools: ["router", "chisel", "circular-saw"], mistakes: ["Making the dado too wide — plywood is often thinner than 3/4\""], safety: ["Clamp the guide and the work."], exercise: "Cut a dado in scrap and fit a shelf into it.",
    diagram: "dado",
  },
  {
    key: "mortise-tenon", title: "Mortise and tenon", category: "joinery", level: "advanced", minutes: 10,
    summary: "The classic furniture joint: a tongue (tenon) fits a slot (mortise).",
    sections: [
      { heading: "Why use it", body: "It's one of the strongest joints for legs and rails because the long-grain glue surfaces are large and the joint resists racking." },
      { heading: "Proportions", body: "A tenon is typically one-third the thickness of the rail. The mortise is cut first; the tenon is fitted to it." },
    ],
    tools: ["chisel", "router", "drill"], mistakes: ["Tenon too tight — it can split the mortise"], safety: ["Keep both hands behind the chisel edge."], exercise: "Cut a single mortise and tenon in 2x4 scraps.",
    diagram: "mortise",
  },
  {
    key: "dovetails", title: "Dovetail joints", category: "joinery", level: "advanced", minutes: 12,
    summary: "Interlocking tails and pins — beautiful and mechanically locked.",
    sections: [
      { heading: "Why", body: "Dovetails resist being pulled apart in one direction, which is why they're used on drawer fronts." },
      { heading: "Approach", body: "Hand-cut with a saw and chisels, or use a router with a dovetail jig. Expect to practice on scrap several times." },
    ],
    tools: ["chisel", "router"], mistakes: ["Sawing on the wrong side of the line"], safety: [], exercise: "Cut one through-dovetail in pine.",
    diagram: "dovetail",
  },
  {
    key: "dowels-biscuits", title: "Dowels and biscuits", category: "joinery", level: "intermediate", minutes: 6,
    summary: "Hidden alignment and reinforcement for edge and corner joints.",
    sections: [
      { heading: "Dowels", body: "Wooden pins glued into matching holes. A doweling jig makes the holes line up. Great for hidden joints in solid wood." },
      { heading: "Biscuits", body: "Football-shaped wafers glued into slots cut by a biscuit joiner; mostly for alignment when gluing panels." },
    ],
    tools: ["dowel-jig", "drill", "clamps"], mistakes: ["Drilling holes too deep and running out of glue surface"], safety: [], exercise: "Join two boards edge-to-edge with three dowels.",
    diagram: "dowel",
  },
  {
    key: "squaring", title: "Checking for square", category: "fundamentals", level: "complete-beginner", minutes: 4,
    summary: "Equal diagonals mean a square box. Here's the quickest check there is.",
    sections: [
      { heading: "The diagonal check", body: "Measure corner to corner both ways. If the two diagonals match, the assembly is square. If not, push on the longer diagonal's corners until they match." },
    ],
    tools: ["tape-measure", "speed-square"], mistakes: ["Attaching the back before checking square"], safety: [], exercise: "Assemble a frame loosely and practice adjusting it to equal diagonals.",
    diagram: "square",
  },
  {
    key: "installing-shelves", title: "Installing wall shelves", category: "home", level: "beginner", minutes: 7,
    summary: "Find studs, use the right anchors, and keep it level.",
    sections: [
      { heading: "Studs first", body: "Studs are typically 16\" apart. Screwing into studs is far stronger than any drywall anchor." },
      { heading: "Anchors", body: "When you can't hit a stud, use anchors rated well above your load. Toggle bolts are strongest in drywall." },
    ],
    tools: ["stud-finder", "level", "drill"], mistakes: ["Trusting plastic anchors with heavy loads"], safety: ["Don't drill directly above or below outlets and switches — wires run there."], exercise: "Locate and mark three studs on a wall.",
  },
  {
    key: "drywall-repair", title: "Basic drywall repair", category: "home", level: "beginner", minutes: 8,
    summary: "Patch holes from nails to fist-sized dents.",
    sections: [
      { heading: "Small holes", body: "Fill with lightweight spackle, let it dry, sand flush and paint." },
      { heading: "Larger holes", body: "Use a self-adhesive mesh patch or cut in a drywall piece, then apply 2–3 thin coats of joint compound, feathering wider each time." },
    ],
    tools: ["sanding-block"], mistakes: ["One thick coat instead of several thin ones"], safety: ["Check for wires and pipes before cutting into a wall."], exercise: "Patch a nail hole until it's invisible after painting.",
  },
  {
    key: "painting", title: "Painting furniture and trim", category: "home", level: "complete-beginner", minutes: 6,
    summary: "Primer, light sanding, and thin coats are the secret to a smooth paint job.",
    sections: [
      { heading: "Prep", body: "Fill holes, sand to 180, remove dust, and prime. Primer seals knots and gives paint something to grip." },
      { heading: "Apply", body: "Use thin coats with a quality brush or foam roller. Sand lightly with 220 between coats." },
    ],
    tools: ["sanding-block"], mistakes: ["Skipping primer on knotty pine — knots bleed through"], safety: ["Ventilate the room."], exercise: "Paint a sample board with and without primer.",
  },
  {
    key: "electrical-plumbing-concepts", title: "Electrical & plumbing: what DIYers should know", category: "home", level: "beginner", minutes: 6,
    summary: "Concepts only — and where to draw the line and call a professional.",
    sections: [
      { heading: "Electrical", body: "Always shut off the breaker and confirm power is off with a non-contact tester. Replacing a light switch or fixture on an existing circuit is a common DIY task in many areas, but new circuits, panels, and wiring changes typically require a licensed electrician and a permit." },
      { heading: "Plumbing", body: "Know where your main water shut-off is. Replacing a faucet or toilet fill valve is commonly DIY; moving drains or supply lines often needs a plumber and a permit." },
      { heading: "When to stop", body: "Woodly won't generate plans for wiring, gas, or structural work. If a project touches these, it's flagged for professional guidance." },
    ],
    tools: [], mistakes: ["Assuming a circuit is off because a switch is off"], safety: ["If unsure, stop and call a licensed professional. Codes vary by location."], exercise: "Find your home's main water shut-off and electrical panel and label them.",
  },
];

export const LESSON_BY_KEY: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.key, l]));
