import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/state/store";
import { aiAvailable, PROVIDERS } from "@/ai";
import { clarify, generateProject, offlineGenerate, type ClarifyResult } from "@/ai/generate";
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

type Phase = "idea" | "asking" | "questions" | "generating";

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
  const autoStarted = useRef(false);

  async function fromTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key)!;
    const p = await createProject(structuredClone(t.spec), `Template: ${t.spec.name}`, `template:${t.key}`);
    nav(`/projects/${p.id}`);
  }

  async function start() {
    setError(undefined);
    if (!idea.trim()) return;
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
      setPhase("asking");
      const c = await clarify(settings, idea);
      setClar(c);
      if (c.questions.length) setPhase("questions");
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
      const res = await generateProject(settings, idea, qa, setProgress);
      const p = await createProject(res.spec, idea, res.origin);
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

      {phase === "idea" || phase === "asking" ? (
        <div className="card p-6">
          <textarea
            className="input min-h-28 text-base"
            placeholder="What do you want to build? Include sizes, where it goes, and anything it needs to hold."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={phase === "asking"}
          />
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
            <button className="btn-primary" onClick={start} disabled={!idea.trim() || phase === "asking"}>
              {phase === "asking" ? (
                <>
                  <Spinner /> Thinking…
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
          <div className="label">A few questions</div>
          <p className="mt-1 text-sm text-charcoal-700">{clar.summary}</p>
          {clar.safetyNote && (
            <div className="mt-3">
              <Callout tone="warn" title="Safety note">
                {clar.safetyNote}
              </Callout>
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
            <button className="btn-primary" onClick={() => generate()}>
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
