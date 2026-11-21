import { afterEach, describe, expect, it } from "vitest";
import { PROVIDERS } from "@/ai";
import { extractJSON, generateProject, offlineGenerate } from "@/ai/generate";
import { specSystemPrompt } from "@/ai/prompts";
import { DEFAULT_SETTINGS, type Settings } from "@/data/types";
import { TEMPLATES } from "@/templates";
import type { CompletionRequest } from "@/ai/types";

const settings: Settings = { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, configured: ["anthropic"] } };
const original = PROVIDERS.anthropic.complete;
afterEach(() => {
  PROVIDERS.anthropic.complete = original;
});

describe("extractJSON", () => {
  it("tolerates fences and prose", () => {
    expect(extractJSON('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(() => extractJSON("no json here")).toThrow();
  });
});

describe("offline generation", () => {
  it("applies dimensions from the prompt, clamped to the template's limits", () => {
    const r = offlineGenerate("a bookshelf 72 inches tall and 3 ft wide")!;
    expect(r.templateKey).toBe("bookshelf");
    const p = Object.fromEntries(r.spec.parameters.map((x) => [x.key, x.value]));
    expect(p.height).toBe(72);
    expect(p.width).toBe(36);
    expect(offlineGenerate("a desk 200 inches wide")!.spec.parameters.find((x) => x.key === "width")!.value).toBe(72);
  });
});

describe("AI generation pipeline", () => {
  it("feeds validator errors back to the model and accepts the repaired spec", async () => {
    const good = TEMPLATES.find((t) => t.key === "storage-bench")!.spec;
    // First reply: a part floats in mid-air (engine validation error).
    const broken = structuredClone(good);
    broken.components[4].positions = [{ x: 0, y: 0, z: 100 }];
    const calls: CompletionRequest[] = [];
    PROVIDERS.anthropic.complete = async (req) => {
      calls.push(req);
      return JSON.stringify(calls.length === 1 ? broken : good);
    };
    const res = await generateProject(settings, "storage bench", []);
    expect(res.attempts).toBe(2);
    expect(res.analysis.validation.status).not.toBe("blocked");
    const repairMsg = calls[1].messages.at(-1)!.text;
    expect(repairMsg).toMatch(/not connected to the main assembly: C1/);
    expect(calls[0].model).toBe("claude-opus-5-5");
  });

  it("repairs schema errors too", async () => {
    const good = TEMPLATES.find((t) => t.key === "floating-shelf")!.spec;
    let n = 0;
    PROVIDERS.anthropic.complete = async () => (++n === 1 ? JSON.stringify({ ...good, components: [{ ...good.components[0], id: "shelf" }] }) : JSON.stringify(good));
    const res = await generateProject(settings, "floating shelf", []);
    expect(res.attempts).toBe(2);
  });

  it("system prompt lists real stock keys and includes a valid example", () => {
    const p = specSystemPrompt();
    expect(p).toContain("pine-1x12");
    expect(p).toContain("pocket-holes");
    expect(p).toContain('"schemaVersion":1');
  });
});
