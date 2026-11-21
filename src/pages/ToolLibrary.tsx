import { useState } from "react";
import { TOOL_LIBRARY, toolName } from "@/content/tools";
import { useApp } from "@/state/store";
import { Callout, PageHeader } from "@/components/ui";
import { money } from "@/engine/format";

export default function ToolLibrary() {
  const { settings, update } = useApp();
  const owned = new Set(settings.profile.ownedTools);
  const [open, setOpen] = useState<string>();
  const toggle = (k: string) =>
    update((s) => ({ ...s, profile: { ...s.profile, ownedTools: owned.has(k) ? s.profile.ownedTools.filter((t) => t !== k) : [...s.profile.ownedTools, k] } }));
  const tools = Object.values(TOOL_LIBRARY);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader title="Tool library" subtitle={`You own ${owned.size} tools. Woodly uses your inventory to suggest alternatives when a project needs something you don't have.`} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <div key={t.key} className={`card p-4 ${owned.has(t.key) ? "border-sage-500/40" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs capitalize text-charcoal-700/70">{t.category}{t.power ? " · power tool" : ""} · ~{money(t.approxPrice)}</div>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" className="accent-sage-500" checked={owned.has(t.key)} onChange={() => toggle(t.key)} /> I own this
              </label>
            </div>
            <p className="mt-2 text-sm">{t.description}</p>
            <button className="mt-2 text-xs text-wood-700 underline" onClick={() => setOpen(open === t.key ? undefined : t.key)}>
              {open === t.key ? "Less" : "How to use · safety · alternatives"}
            </button>
            {open === t.key && (
              <div className="mt-2 space-y-2 text-sm">
                {t.howTo.length > 0 && <ul className="list-disc pl-5">{t.howTo.map((h) => <li key={h}>{h}</li>)}</ul>}
                {t.safety.length > 0 && <Callout tone="warn" title="Safety"><ul className="list-disc pl-4">{t.safety.map((h) => <li key={h}>{h}</li>)}</ul></Callout>}
                {t.alternatives.length > 0 && (
                  <div>
                    <div className="label">Don't have one?</div>
                    <ul className="mt-1 space-y-1">{t.alternatives.map((a) => <li key={a.tool}><b>{toolName(a.tool)}</b>: {a.how}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
