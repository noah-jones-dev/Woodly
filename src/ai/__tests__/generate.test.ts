import { afterEach, describe, expect, it } from "vitest";
import { PROVIDERS } from "@/ai";
import { describePhotos, extractJSON, generateProject, ideaText, offlineGenerate } from "@/ai/generate";
import { fitWithin } from "@/lib/images";
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

describe("designing from a photo", () => {
  const photo = { mediaType: "image/jpeg" as const, base64: "AAAA" };

  it("sends photos to the vision route and returns a text brief", async () => {
    const calls: CompletionRequest[] = [];
    PROVIDERS.anthropic.complete = async (req) => {
      calls.push(req);
      return "  A three-shelf pine bookcase, about 30 x 11 x 48 in.  ";
    };
    const vision = { ...settings, ai: { ...settings.ai, routes: { ...settings.ai.routes, vision: { provider: "anthropic" as const, model: "claude-sonnet-5-5" } } } };
    const brief = await describePhotos(vision, [photo], "but painted white");
    expect(brief).toBe("A three-shelf pine bookcase, about 30 x 11 x 48 in.");
    expect(calls[0].model).toBe("claude-sonnet-5-5");
    expect(calls[0].messages[0].images).toEqual([photo]);
    expect(calls[0].messages[0].text).toMatch(/painted white/);
  });

  it("skips the vision call when there are no photos", async () => {
    PROVIDERS.anthropic.complete = async () => {
      throw new Error("should not be called");
    };
    expect(await describePhotos(settings, [])).toBe("");
  });

  it("feeds the photo brief into spec generation as text", async () => {
    const good = TEMPLATES.find((t) => t.key === "bookshelf")!.spec;
    const calls: CompletionRequest[] = [];
    PROVIDERS.anthropic.complete = async (req) => {
      calls.push(req);
      return JSON.stringify(good);
    };
    await generateProject(settings, "", [], undefined, "A three-shelf pine bookcase");
    const msg = calls[0].messages[0];
    expect(msg.text).toMatch(/From the user's photo\(s\): A three-shelf pine bookcase/);
    expect(msg.images).toBeUndefined(); // the blueprint model only ever sees text
  });

  it("combines typed and photo descriptions", () => {
    expect(ideaText("a desk")).toBe("a desk");
    expect(ideaText("", "a bench")).toMatch(/^Build what's shown.*a bench$/s);
    expect(ideaText("wider", "a bench")).toMatch(/^wider\n\nFrom the user's photo\(s\): a bench$/);
  });

  it("scales large photos to fit the long edge, keeping aspect ratio", () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 1568, h: 1176 });
    expect(fitWithin(3024, 4032)).toEqual({ w: 1176, h: 1568 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
