import { useEffect, useRef, useState } from "react";
import type { Analysis } from "@/engine";
import { parseQuickEdit, setParameter } from "@/engine";
import type { ProjectSpec } from "@/engine/spec";
import type { ProjectRecord } from "@/data/types";
import { useApp } from "@/state/store";
import { aiAvailable, isTaskConfigured, type ImageInput } from "@/ai";
import { askAssistant, projectContext, reviseProject } from "@/ai/generate";
import { useFormat } from "@/lib/useFormat";
import { Callout, Spinner } from "@/components/ui";

/** Design Studio: live parameter sliders + natural-language revisions. */
export function ParametersPanel({ spec, onChange }: { spec: ProjectSpec; onChange: (s: ProjectSpec, note: string) => void }) {
  const settings = useApp((s) => s.settings);
  const { fmt } = useFormat(spec);
  const [draft, setDraft] = useState(spec);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "tip" | "danger"; text: string }>();
  const timer = useRef<number>();
  useEffect(() => {
    setDraft(spec);
  }, [spec]);

  // Sliders update the drawings instantly; the version is saved after a pause.
  const setParam = (key: string, value: number) => {
    const next = setParameter(draft, key, value);
    setDraft(next);
    window.clearTimeout(timer.current);
    const p = next.parameters.find((x) => x.key === key)!;
    timer.current = window.setTimeout(() => onChange(next, `${p.label} → ${p.kind === "count" ? p.value : fmt(p.value)}`), 600);
  };

  async function revise() {
    setMsg(undefined);
    const quick = parseQuickEdit(draft, request);
    if (quick) {
      let next = draft;
      for (const q of quick) next = setParameter(next, q.key, q.value);
      onChange(next, request);
      setMsg({ tone: "tip", text: `Updated ${quick.map((q) => q.label).join(", ")} — every affected part, cut and drawing was recalculated.` });
      setRequest("");
      return;
    }
    if (!aiAvailable(settings)) {
      setMsg({ tone: "danger", text: "That change needs the AI (try “12 inches wider” or “add a shelf” for instant edits). Connect a provider in Settings." });
      return;
    }
    try {
      setBusy("Revising…");
      const res = await reviseProject(settings, draft, request, setBusy);
      onChange(res.spec, `AI revision: ${request}`);
      setMsg({ tone: "tip", text: "Design revised and re-validated." });
      setRequest("");
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      {draft.parameters.map((p) => (
        <div key={p.key}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{p.label}</span>
            <span className="font-mono text-xs">{p.kind === "count" ? p.value : fmt(p.value)}</span>
          </div>
          <input
            type="range"
            className="w-full accent-wood-600"
            min={p.min ?? 0}
            max={p.max ?? p.value * 2}
            step={p.step ?? (p.kind === "count" ? 1 : 0.25)}
            value={p.value}
            onChange={(e) => setParam(p.key, parseFloat(e.target.value))}
          />
          {p.description && <div className="text-[11px] text-charcoal-700/70">{p.description}</div>}
        </div>
      ))}
      <div>
        <div className="label mb-1">Revise the design</div>
        <textarea className="input min-h-16" placeholder="“Make it 12 inches wider”, “add a drawer”, “use oak instead of pine”…" value={request} onChange={(e) => setRequest(e.target.value)} />
        <button className="btn-primary mt-2 w-full" onClick={revise} disabled={!request.trim() || !!busy}>
          {busy ? (
            <>
              <Spinner /> {busy}
            </>
          ) : (
            "Apply change"
          )}
        </button>
        {msg && (
          <div className="mt-2">
            <Callout tone={msg.tone}>{msg.text}</Callout>
          </div>
        )}
      </div>
    </div>
  );
}

export function ValidationPanel({ analysis }: { analysis: Analysis }) {
  const { status, issues } = analysis.validation;
  const order = { error: 0, warning: 1, info: 2 } as const;
  return (
    <div className="space-y-2">
      <Callout tone={status === "ok" ? "tip" : status === "review" ? "warn" : "danger"} title={status === "ok" ? "All checks passed" : status === "review" ? "Review before building" : "Not buildable yet"}>
        {status === "blocked"
          ? "The design has errors that must be fixed. Use “Revise the design” or adjust parameters."
          : "Measurements, stock sizes, connections and assembly order were checked automatically. This is not an engineering review."}
      </Callout>
      {[...issues]
        .sort((a, b) => order[a.severity] - order[b.severity])
        .map((i, n) => (
          <div key={n} className="flex gap-2 text-xs">
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${i.severity === "error" ? "bg-danger-500" : i.severity === "warning" ? "bg-warn-500" : "bg-charcoal-700/30"}`} />
            <span>{i.message}</span>
          </div>
        ))}
    </div>
  );
}

async function fileToImage(f: File): Promise<ImageInput & { dataUrl: string }> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
  const [head, base64] = dataUrl.split(",");
  const mediaType = (/data:(.*?);/.exec(head)?.[1] ?? "image/jpeg") as ImageInput["mediaType"];
  return { mediaType, base64, dataUrl };
}

/** Project-aware chat. Answers use this project's parts, steps and cut list. */
export function AssistantPanel({ project, analysis, onChat }: { project: ProjectRecord; analysis: Analysis; onChat: (chat: ProjectRecord["chat"]) => void }) {
  const settings = useApp((s) => s.settings);
  const [q, setQ] = useState("");
  const [img, setImg] = useState<ImageInput & { dataUrl: string }>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: scrollIntoView can return a Promise in newer browsers, and
  // anything an effect returns is treated as its cleanup function.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [project.chat.length]);

  if (!isTaskConfigured(settings, "text"))
    return <div className="text-sm text-charcoal-700/80">Connect an AI provider in Settings to ask questions about this project, like “Why pocket holes here?” or “I cut A1 two inches short — what now?”</div>;

  async function send() {
    if (!q.trim()) return;
    const question = q;
    const images = img ? [{ mediaType: img.mediaType, base64: img.base64 }] : [];
    const history = project.chat;
    setQ("");
    setImg(undefined);
    setBusy(true);
    setErr(undefined);
    const withQ = [...history, { role: "user" as const, text: question + (images.length ? " [photo attached]" : "") }];
    onChat(withQ);
    try {
      const answer = await askAssistant(settings, projectContext(project.spec, analysis, project.completedSteps), history, question, images);
      onChat([...withQ, { role: "assistant", text: answer }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {project.chat.length === 0 && <div className="text-xs text-charcoal-700/70">Ask anything about this build: “Can I use pine instead of oak?”, “Simplify step 4”, or attach a photo of your progress.</div>}
        {project.chat.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "ml-6 bg-wood-600/10" : "mr-2 bg-cream-200/70"}`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-charcoal-700/70">
            <Spinner /> Thinking…
          </div>
        )}
        <div ref={end} />
      </div>
      {err && <Callout tone="danger">{err}</Callout>}
      {img && (
        <div className="flex items-center gap-2 text-xs">
          <img src={img.dataUrl} className="h-10 w-10 rounded object-cover" alt="attachment" />
          <button className="underline" onClick={() => setImg(undefined)}>
            remove
          </button>
        </div>
      )}
      <textarea className="input min-h-14" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this project…" onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} />
      <div className="flex gap-2">
        <label className="btn-secondary cursor-pointer px-3" title="Attach a photo">
          📷
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => e.target.files?.[0] && setImg(await fileToImage(e.target.files[0]))} />
        </label>
        <button className="btn-primary flex-1" onClick={send} disabled={busy || !q.trim()}>
          Ask
        </button>
      </div>
    </div>
  );
}

export { fileToImage };
