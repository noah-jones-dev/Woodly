/**
 * AI project pipeline:
 *
 *   idea ─▶ clarify (questions) ─▶ generate spec JSON ─▶ zod schema check
 *                                         ▲                    │
 *                                         └── repair (≤2×) ◀───┤ engine validation errors
 *                                                              ▼
 *                                                     spec + validation report
 *
 * The AI only proposes; the engine decides whether the design is coherent.
 */
import { analyze, type Analysis } from "@/engine";
import { ProjectSpec, type ProjectSpec as Spec } from "@/engine/spec";
import { formatLength } from "@/engine/format";
import { matchTemplate } from "@/templates";
import type { Profile, Settings } from "@/data/types";
import { runTask } from "./index";
import { assistantSystemPrompt, clarifySystemPrompt, photoBriefSystemPrompt, profileText, specSystemPrompt } from "./prompts";
import { AIError, type ChatMessage, type ImageInput } from "./types";

export type ClarifyQuestion = { id: string; question: string; options: string[] };
export type ClarifyResult = { summary: string; questions: ClarifyQuestion[]; safetyNote?: string };

/** Pull the first JSON object out of a reply (tolerates stray prose or ``` fences). */
export function extractJSON(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AIError("The AI reply didn't contain JSON.", "format");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    throw new AIError(`The AI reply wasn't valid JSON: ${(e as Error).message}`, "format");
  }
}

/**
 * Photo → text design brief, on the user's "vision" route. Returns plain text
 * that the clarify and spec steps then treat like part of the idea.
 */
export async function describePhotos(settings: Settings, images: ImageInput[], idea = ""): Promise<string> {
  if (!images.length) return "";
  const { text } = await runTask(settings, "vision", {
    system: photoBriefSystemPrompt(),
    messages: [
      {
        role: "user",
        text: `${idea.trim() ? `The user's description: ${idea.trim()}` : "The user didn't write a description — work from the photos."}\n\nDescribe what to build.`,
        images,
      },
    ],
    maxTokens: 2000,
    effort: "medium",
  });
  return text.trim();
}

/** The idea as the model sees it: typed description plus any photo brief. */
export function ideaText(idea: string, photoBrief?: string): string {
  const typed = idea.trim();
  const brief = photoBrief?.trim();
  if (!brief) return typed;
  return `${typed || "Build what's shown in the user's photo(s)."}\n\nFrom the user's photo(s): ${brief}`;
}

export async function clarify(settings: Settings, idea: string, photoBrief?: string): Promise<ClarifyResult> {
  const full = ideaText(idea, photoBrief);
  const { text } = await runTask(settings, "text", {
    system: clarifySystemPrompt(),
    messages: [{ role: "user", text: `${profileText(settings.profile)}\n\nIdea: ${full}` }],
    json: true,
    maxTokens: 4000,
    effort: "low",
  });
  const raw = extractJSON(text) as Partial<ClarifyResult>;
  return {
    summary: String(raw.summary ?? full),
    questions: (raw.questions ?? []).slice(0, 4).map((q, i) => ({ id: String(q.id ?? `q${i}`), question: String(q.question), options: (q.options ?? []).map(String) })),
    safetyNote: raw.safetyNote ? String(raw.safetyNote) : undefined,
  };
}

export type GenerateResult = { spec: Spec; origin: string; analysis: Analysis; attempts: number };

/** Render engine/schema problems as a repair instruction for the model. */
function problemsText(problems: string[]) {
  return `Woodly's validator found these problems. Fix all of them and reply with the complete corrected JSON spec only:\n- ${problems.join("\n- ")}`;
}

async function specLoop(settings: Settings, task: "blueprint" | "reasoning", messages: ChatMessage[], onProgress?: (m: string) => void): Promise<GenerateResult> {
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    onProgress?.(attempt === 1 ? "Designing your project…" : `Fixing ${lastErrors.length} problem(s) the validator found (attempt ${attempt})…`);
    const { text, origin } = await runTask(settings, task, { system: specSystemPrompt(), messages, json: true, effort: "high", maxTokens: 32000 });
    messages = [...messages, { role: "assistant", text }];

    let spec: Spec;
    try {
      spec = ProjectSpec.parse(extractJSON(text));
    } catch (e) {
      lastErrors =
        e instanceof Error && "issues" in e
          ? (e as unknown as { issues: { path: (string | number)[]; message: string }[] }).issues.slice(0, 15).map((i) => `${i.path.join(".")}: ${i.message}`)
          : [(e as Error).message];
      messages = [...messages, { role: "user", text: problemsText(lastErrors) }];
      continue;
    }
    onProgress?.("Checking the design…");
    const analysis = analyze(spec);
    lastErrors = analysis.validation.issues.filter((i) => i.severity === "error").map((i) => i.message);
    if (!lastErrors.length || attempt === 3) return { spec, origin, analysis, attempts: attempt };
    messages = [...messages, { role: "user", text: problemsText(lastErrors) }];
  }
  throw new AIError(`The AI couldn't produce a valid design. Last problems: ${lastErrors.slice(0, 3).join("; ")}`, "format");
}

export async function generateProject(
  settings: Settings,
  idea: string,
  answers: { question: string; answer: string }[],
  onProgress?: (m: string) => void,
  photoBrief?: string,
): Promise<GenerateResult> {
  idea = ideaText(idea, photoBrief);
  const qa = answers.filter((a) => a.answer.trim()).map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n");
  return specLoop(
    settings,
    "blueprint",
    [{ role: "user", text: `${profileText(settings.profile)}\nPreferred units for display: ${settings.profile.units}.\n\nProject idea: ${idea}${qa ? `\n\nClarifications:\n${qa}` : ""}` }],
    onProgress,
  );
}

/** AI-driven revision for edits the deterministic quick-edit parser can't handle. */
export async function reviseProject(settings: Settings, spec: Spec, request: string, onProgress?: (m: string) => void) {
  return specLoop(
    settings,
    "reasoning",
    [
      {
        role: "user",
        text: `${profileText(settings.profile)}\n\nHere is the current project spec:\n${JSON.stringify(spec)}\n\nRevise it: ${request}\n\nKeep component IDs stable for parts that don't change. Reply with the complete revised JSON spec only.`,
      },
    ],
    onProgress,
  );
}

/**
 * Offline / no-key fallback: pick a template and pull simple dimensions out
 * of the prompt ("48 inches wide", "5 ft tall").
 */
export function offlineGenerate(idea: string): { spec: Spec; templateKey: string } | undefined {
  const t = matchTemplate(idea);
  if (!t) return undefined;
  let spec = structuredClone(t.spec);
  const re = /(\d+(?:\.\d+)?)\s*(in|inch|inches|"|ft|foot|feet|')\s*(wide|long|tall|high|deep)/gi;
  for (const m of idea.matchAll(re)) {
    const inches = /^(ft|foot|feet|')$/i.test(m[2]) ? parseFloat(m[1]) * 12 : parseFloat(m[1]);
    const dim = m[3].toLowerCase();
    const target = spec.parameters.find((p) =>
      dim === "wide" ? /width|length/.test(p.key) : dim === "long" ? /length|width/.test(p.key) : dim === "deep" ? /depth/.test(p.key) : /height/.test(p.key),
    );
    if (target) {
      const v = Math.min(target.max ?? Infinity, Math.max(target.min ?? -Infinity, inches));
      spec = { ...spec, parameters: spec.parameters.map((p) => (p.key === target.key ? { ...p, value: v } : p)) };
    }
  }
  return { spec, templateKey: t.key };
}

/** Compact project description for the assistant's system prompt. */
export function projectContext(spec: Spec, a: Analysis, completedSteps: number[]): string {
  const f = (v: number) => formatLength(v, spec.units);
  const b = a.resolved.bbox.size;
  return [
    `${spec.name} — ${spec.summary}`,
    `Overall: ${f(b.x)} W × ${f(b.y)} D × ${f(b.z)} H. Difficulty: ${spec.difficulty}.`,
    `Parameters: ${spec.parameters.map((p) => `${p.label}=${p.kind === "count" ? p.value : f(p.value)}`).join(", ")}`,
    `Cut list:\n${a.cutList.map((r) => `  ${r.id} ${r.name} ×${r.quantity}: ${f(r.thickness)} × ${f(r.width)} × ${f(r.length)} ${r.material}${r.needsRip ? " (rip to width)" : ""}`).join("\n")}`,
    `Joints: ${spec.joints.map((j) => `${j.a}–${j.b} ${j.type}`).join(", ") || "none"}`,
    `Hardware: ${spec.hardware.map((h) => `${h.id} (${h.stock}) for ${h.usage}`).join("; ")}`,
    `Steps:\n${spec.steps.map((s, i) => `  ${i + 1}. ${s.title}${completedSteps.includes(i) ? " [done]" : ""}: ${s.description}`).join("\n")}`,
    `Validation: ${a.validation.status}. ${a.validation.issues.map((i) => `[${i.severity}] ${i.message}`).join(" ")}`,
    `Assumptions: ${spec.assumptions.join("; ")}`,
  ].join("\n");
}

export async function askAssistant(
  settings: Settings,
  context: string,
  history: ChatMessage[],
  question: string,
  images: ImageInput[] = [],
): Promise<string> {
  const { text } = await runTask(settings, images.length ? "vision" : "text", {
    system: assistantSystemPrompt(context),
    messages: [...history.slice(-12).map((m) => ({ role: m.role, text: m.text })), { role: "user", text: question, images }],
    maxTokens: 8000,
    effort: "medium",
  });
  return text;
}

export const profileSummary = (p: Profile) => profileText(p);
