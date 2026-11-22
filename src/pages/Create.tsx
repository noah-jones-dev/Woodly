import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/state/store";
import { aiAvailable, isTaskConfigured, PROVIDERS } from "@/ai";
import { clarify, describePhotos, generateProject, ideaText, offlineGenerate, type ClarifyResult } from "@/ai/generate";
import { fileToImage, toImageInput, type PickedImage } from "@/lib/images";
import { createProject } from "@/data/projects";
import { TEMPLATES } from "@/templates";
import { analyze } from "@/engine";
import { boxesFor, IsoView } from "@/blueprint/iso";
import { Callout, DifficultyChip, PageHeader, Spinner } from "@/components/ui";

const EXAMPLES = [
  "Build me a modern farmhouse coffee table.",
  "I want a floating bookshelf that fits above my desk.",
  "Design a wooden storage bench with a hinged lid.",
  "Help me build a gaming desk with cable management.",
  "I want to build a chicken coop for six chickens.",
  "A tall bookshelf, 72 inches tall, for my kids' room.",
];

type Phase = "idea" | "seeing" | "asking" | "questions" | "generating";

const MAX_PHOTOS = 4;

export default function Create() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const settings = useApp((s) => s.settings);
  const hasAI = aiAvailable(settings);
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [phase, setPhase] = useState<Phase>("idea");
  const [clar, setClar] = useState<ClarifyResult>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string>();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  /** What the vision model saw. Shown to the user, who can correct it before generating. */
  const [photoBrief, setPhotoBrief] = useState("");
  const [dragging, setDragging] = useState(false);
  const autoStarted = useRef(false);
  const busy = phase === "seeing" || phase === "asking";
  const canStart = (!!idea.trim() || photos.length > 0) && !busy;

  async function addPhotos(files: FileList | File[]) {
    setError(undefined);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length > room) setError(`You can attach up to ${MAX_PHOTOS} photos.`);
    try {
      const imgs = await Promise.all(picked.slice(0, Math.max(0, room)).map(fileToImage));
      setPhotos((p) => [...p, ...imgs]);
      setPhotoBrief(""); // photos changed — the old description no longer applies
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function fromTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    const p = await createProject(structuredClone(t.spec), `Template: ${t.spec.name}`, `template:${t.key}`);
    nav(`/projects/${p.id}`);
  }

  async function start() {
    setError(undefined);
    if (!canStart) return;
    if (photos.length && !isTaskConfigured(settings, "vision")) {
      setError("Designing from a photo needs an AI provider for the Vision task. Connect one in Settings → AI providers, or describe the project in words instead.");
      return;
    }
    if (!hasAI) {
      const off = offlineGenerate(idea);
      if (!off) {
        setError("Without an AI provider, Woodly can only build from its templates, and none matches that idea. Connect an AI provider in Settings, or pick a template below.");
        return;
      }
      const p = await createProject(off.spec, idea, `template:${off.templateKey}`);
      nav(`/projects/${p.id}`);
      return;
    }
    try {
      let brief = "";
      if (photos.length) {
        setPhase("seeing");
        brief = await describePhotos(settings, photos.map(toImageInput), idea);
        setPhotoBrief(brief);
      }
      setPhase("asking");
      const c = await clarify(settings, idea, brief);
      setClar(c);
      // With photos, always stop here so the user can check what Woodly saw.
      if (c.questions.length || brief) setPhase("questions");
      else await generate(c);
    } catch (e) {
      setError((e as Error).message);
      setPhase("idea");
    }
  }

  async function generate(c = clar) {
    setPhase("generating");
    setError(undefined);
    try {
      const qa = (c?.questions ?? []).map((q) => ({ question: q.question, answer: answers[q.id] ?? "" }));
      const res = await generateProject(settings, idea, qa, setProgress, photoBrief);
      const p = await createProject(res.spec, ideaText(idea, photoBrief), res.origin);
      nav(`/projects/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
      setPhase(c?.questions.length ? "questions" : "idea");
    }
  }

  useEffect(() => {
    const t = params.get("template");
    if (t && !autoStarted.current) {
      autoStarted.current = true;
      fromTemplate(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader title="Create a project" subtitle="Describe what you want to build. Woodly designs it, checks it, and writes the manual." />

      {phase === "idea" || busy ? (
        <div
          className={`card p-6 ${dragging ? "ring-2 ring-wood-600" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) addPhotos(e.dataTransfer.files);
          }}
        >
          <textarea
            className="input min-h-28 text-base"
            placeholder={photos.length ? "Anything to add or change? e.g. “like this, but 48 inches wide and painted white”" : "What do you want to build? Include sizes, where it goes, and anything it needs to hold — or attach a photo."}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                addPhotos(files);
              }
            }}
            disabled={busy}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.dataUrl} alt={`Attached photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                {!busy && (
                  <button
                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-charcoal-700 text-xs text-cream-50"
                    title="Remove photo"
                    onClick={() => {
                      setPhotos((ps) => ps.filter((_, j) => j !== i));
                      setPhotoBrief("");
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className={`btn-secondary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`} title="Attach a photo of something you want to build, a sketch, or the space it goes in">
                📷 {photos.length ? "Add another" : "Add a photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addPhotos(e.target.files);
                    e.target.value = ""; // allow re-picking the same file
                  }}
                />
              </label>
            )}
            {!photos.length && <span className="text-xs text-charcoal-700/70">A piece you like, a sketch, or the spot it'll go. You can also drag or paste images here.</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} className="chip bg-cream-200 text-charcoal-700 hover:bg-wood-300/50" onClick={() => setIdea(e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-xs text-charcoal-700/70">
              {hasAI ? (
                <>
                  Using {PROVIDERS[settings.ai.routes.blueprint.provider].name} · {settings.ai.routes.blueprint.model}. API usage is billed by your provider.
                </>
              ) : (
                <>
                  Offline mode: matches your idea to a built-in template. <Link to="/settings" className="underline">Connect AI</Link> for custom designs.
                </>
              )}
            </div>
            <button className="btn-primary" onClick={start} disabled={!canStart}>
              {busy ? (
                <>
                  <Spinner /> {phase === "seeing" ? "Looking at your photo…" : "Thinking…"}
                </>
              ) : (
                "Design it"
              )}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "questions" && clar && (
        <div className="card p-6">
          <div className="label">{clar.questions.length ? "A few questions" : "Check the details"}</div>
          <p className="mt-1 text-sm text-charcoal-700">{clar.summary}</p>
          {clar.safetyNote && (
            <div className="mt-3">
              <Callout tone="warn" title="Safety note">
                {clar.safetyNote}
              </Callout>
            </div>
          )}
          {photoBrief && (
            <div className="mt-4">
              <div className="flex items-start gap-3">
                {photos.slice(0, 1).map((p, i) => (
                  <img key={i} src={p.dataUrl} alt="Your photo" className="h-16 w-16 flex-none rounded-lg object-cover" />
                ))}
                <div className="flex-1">
                  <div className="font-medium">What Woodly sees in your photo{photos.length > 1 ? "s" : ""}</div>
                  <p className="text-xs text-charcoal-700/70">Sizes are estimated from the photo. Fix anything that's wrong — this is what the design is built from.</p>
                </div>
              </div>
              <textarea className="input mt-2 min-h-32 text-sm" value={photoBrief} onChange={(e) => setPhotoBrief(e.target.value)} />
            </div>
          )}
          <div className="mt-4 space-y-5">
            {clar.questions.map((q) => (
              <div key={q.id}>
                <div className="font-medium">{q.question}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <button key={o} className={`chip px-3 py-1 ${answers[q.id] === o ? "bg-wood-600 text-cream-50" : "bg-cream-200 hover:bg-wood-300/50"}`} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}>
                      {o}
                    </button>
                  ))}
                </div>
                <input className="input mt-2" placeholder="Or type your own answer" value={q.options.includes(answers[q.id] ?? "") ? "" : (answers[q.id] ?? "")} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button className="btn-ghost" onClick={() => setPhase("idea")}>
              ← Edit idea
            </button>
            <button className="btn-primary" onClick={() => generate()} disabled={!!photos.length && !photoBrief.trim()}>
              Generate design
            </button>
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <Spinner />
          <div className="font-medium">{progress || "Designing…"}</div>
          <p className="max-w-md text-sm text-charcoal-700/70">
            The AI writes a structured specification; Woodly's engine then computes every dimension, the cut list and drawings, and checks the design. This can take a minute.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Callout tone="danger" title="Couldn't create the project">
            {error}
          </Callout>
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Or start from a template</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => fromTemplate(t.key)} className="card p-4 text-left hover:border-wood-300">
            <IsoView boxes={boxesFor(analyze(t.spec))} labels={false} height={120} />
            <div className="mt-2 font-medium">{t.spec.name}</div>
            <div className="text-xs text-charcoal-700/70">{t.spec.summary}</div>
            <div className="mt-2">
              <DifficultyChip d={t.spec.difficulty} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
