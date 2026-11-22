import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/state/store";
import { isTaskConfigured, type ChatMessage, type ImageInput } from "@/ai";
import { askAssistant, projectContext } from "@/ai/generate";
import { repo } from "@/data/repo";
import type { ProjectRecord } from "@/data/types";
import { analyze } from "@/engine";
import { Callout, PageHeader, Spinner } from "@/components/ui";
import { fileToImage } from "@/lib/images";

/** General woodworking Q&A, optionally grounded in one of your projects. */
export default function Assistant() {
  const settings = useApp((s) => s.settings);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [pid, setPid] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [q, setQ] = useState("");
  const [img, setImg] = useState<ImageInput & { dataUrl: string }>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    repo.listProjects().then(setProjects);
  }, []);

  if (!isTaskConfigured(settings, "text"))
    return (
      <div className="mx-auto max-w-3xl p-8">
        <PageHeader title="AI assistant" />
        <Callout tone="info">Connect an AI provider in <Link to="/settings" className="underline">Settings</Link> to chat with Woodly's woodworking assistant.</Callout>
      </div>
    );

  async function send() {
    const p = projects.find((x) => x.id === pid);
    const context = p ? projectContext(p.spec, analyze(p.spec), p.completedSteps) : "No specific project selected — answer general woodworking, DIY and home-improvement questions.";
    const question = q;
    const images = img ? [{ mediaType: img.mediaType, base64: img.base64 }] : [];
    const withQ: ChatMessage[] = [...chat, { role: "user", text: question }];
    setChat(withQ);
    setQ("");
    setImg(undefined);
    setBusy(true);
    setErr(undefined);
    try {
      setChat([...withQ, { role: "assistant", text: await askAssistant(settings, context, chat, question, images) }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-8">
      <PageHeader
        title="AI assistant"
        subtitle="Ask about techniques, tools, wood choices or fixing mistakes."
        actions={
          <select className="input w-auto" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">No project context</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        }
      />
      <div className="flex-1 space-y-3 overflow-auto">
        {chat.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "ml-16 bg-wood-600/10" : "mr-16 card"}`}>{m.text}</div>
        ))}
        {busy && <Spinner />}
        {err && <Callout tone="danger">{err}</Callout>}
      </div>
      {img && <img src={img.dataUrl} alt="attachment" className="mt-2 h-14 w-14 rounded object-cover" />}
      <div className="mt-4 flex gap-2">
        <label className="btn-secondary cursor-pointer px-3" title="Attach a photo">📷<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => e.target.files?.[0] && setImg(await fileToImage(e.target.files[0]))} /></label>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && send()} placeholder="How do I keep pine from blotching when I stain it?" />
        <button className="btn-primary" onClick={send} disabled={!q.trim() || busy}>Send</button>
      </div>
    </div>
  );
}
