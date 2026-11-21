import { useState } from "react";
import { useApp } from "@/state/store";
import { PROVIDERS, TASK_LABELS, type AITask, type ProviderId } from "@/ai";
import { credentials } from "@/ai/transport";
import { isTauri } from "@/lib/platform";
import { Callout, DIFFICULTY_LABEL, PageHeader, Spinner } from "@/components/ui";
import type { Difficulty } from "@/engine/spec";

export default function SettingsPage() {
  const { settings, update } = useApp();
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <PageHeader title="Settings" />

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Your profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="label mb-1">Experience level</div>
            <select className="input" value={settings.profile.experience} onChange={(e) => update((s) => ({ ...s, profile: { ...s.profile, experience: e.target.value as Difficulty } }))}>
              {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="mt-1 text-xs text-charcoal-700/70">Designs and instructions adapt to this level.</div>
          </label>
          <label className="block">
            <div className="label mb-1">Measurement units</div>
            <select className="input" value={settings.profile.units} onChange={(e) => update((s) => ({ ...s, profile: { ...s.profile, units: e.target.value as "in" | "mm" } }))}>
              <option value="in">Imperial (inches, fractions)</option>
              <option value="mm">Metric (millimetres)</option>
            </select>
            <div className="mt-1 text-xs text-charcoal-700/70">The stock library uses US lumber sizes; metric shows those sizes converted.</div>
          </label>
        </div>
      </section>

      <section className="card space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold">AI providers (bring your own key)</h2>
          <p className="mt-1 text-sm text-charcoal-700/80">
            Woodly works offline with built-in templates. Connect a provider to design anything. {isTauri ? "Keys are stored in your operating system's credential manager and never written to disk by Woodly or shown again." : "Browser dev mode: keys are kept only for this tab session. Use the desktop app for secure keychain storage."}
          </p>
        </div>
        <Callout tone="warn" title="API usage costs">
          Requests are billed to your account by the AI provider, separately from Woodly. Designing a project typically uses one to three large requests.
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" className="accent-wood-600" checked={settings.ai.acknowledgedCosts} onChange={(e) => update((s) => ({ ...s, ai: { ...s.ai, acknowledgedCosts: e.target.checked } }))} />
            I understand I may be charged by my AI provider.
          </label>
        </Callout>
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => <ProviderRow key={p} id={p} />)}
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Task routing</h2>
          <p className="mt-1 text-sm text-charcoal-700/80">Choose which model handles each job. For example, a fast model for chat and the strongest model for blueprints.</p>
        </div>
        {(Object.keys(TASK_LABELS) as AITask[]).map((t) => <RouteRow key={t} task={t} />)}
        <p className="text-xs text-charcoal-700/70">Concept images are rendered from Woodly's own 3D geometry so they always match the plan; image-generation providers can be added later through the same provider interface.</p>
      </section>
    </div>
  );
}

function ProviderRow({ id }: { id: ProviderId }) {
  const { settings, update } = useApp();
  const provider = PROVIDERS[id];
  const configured = settings.ai.configured.includes(id);
  const [key, setKey] = useState("");
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});

  const setConfigured = (on: boolean) => update((s) => ({ ...s, ai: { ...s.ai, configured: on ? [...new Set([...s.ai.configured, id])] : s.ai.configured.filter((x) => x !== id) } }));

  async function save() {
    setState({ busy: true });
    try {
      await credentials.save(id, key.trim());
      setKey("");
      await setConfigured(true);
      await test();
    } catch (e) {
      setState({ err: (e as Error).message });
    }
  }
  async function test() {
    setState({ busy: true });
    try {
      const models = await provider.listModels();
      setState({ ok: `Connected — ${models.length} models available.` });
    } catch (e) {
      setState({ err: (e as Error).message });
    }
  }
  async function remove() {
    await credentials.remove(id);
    await setConfigured(false);
    setState({});
  }

  return (
    <div className="rounded-xl border border-cream-200 p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">{provider.name}</div>
        {configured ? <span className="chip bg-sage-500/15 text-sage-500">Key saved</span> : <span className="chip bg-cream-200">Not connected</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder={configured ? "Enter a new key to replace the saved one" : provider.keyHint} value={key} onChange={(e) => setKey(e.target.value)} />
        <button className="btn-primary" disabled={!key.trim() || state.busy} onClick={save}>Save</button>
        {configured && <button className="btn-secondary" disabled={state.busy} onClick={test}>Test</button>}
        {configured && <button className="btn-ghost text-danger-500" onClick={remove}>Remove</button>}
      </div>
      <div className="mt-2 text-xs">
        {state.busy && <Spinner />}
        {state.ok && <span className="text-sage-500">{state.ok}</span>}
        {state.err && <span className="text-danger-500">{state.err}</span>}
        {!state.busy && !state.ok && !state.err && (
          <span className="text-charcoal-700/60">Get a key from {provider.consoleUrl.replace(/^https:\/\//, "").split("/")[0]}.</span>
        )}
      </div>
    </div>
  );
}

function RouteRow({ task }: { task: AITask }) {
  const { settings, update } = useApp();
  const route = settings.ai.routes[task];
  const [models, setModels] = useState<string[]>([]);
  const provider = PROVIDERS[route.provider];
  const setRoute = (r: Partial<typeof route>) => update((s) => ({ ...s, ai: { ...s.ai, routes: { ...s.ai.routes, [task]: { ...route, ...r } } } }));
  const listId = `models-${task}`;
  return (
    <div className="grid items-end gap-3 sm:grid-cols-[1fr_180px_1fr_auto]">
      <div>
        <div className="text-sm font-medium">{TASK_LABELS[task].label}</div>
        <div className="text-xs text-charcoal-700/70">{TASK_LABELS[task].description}</div>
      </div>
      <select className="input" value={route.provider} onChange={(e) => {
        const p = e.target.value as ProviderId;
        setRoute({ provider: p, model: PROVIDERS[p].defaultModel });
        setModels([]);
      }}>
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => <option key={p} value={p}>{PROVIDERS[p].name}{settings.ai.configured.includes(p) ? "" : " (no key)"}</option>)}
      </select>
      <div>
        <input className="input font-mono text-xs" list={listId} value={route.model} onChange={(e) => setRoute({ model: e.target.value })} />
        <datalist id={listId}>{[...new Set([...provider.suggestedModels, ...models])].map((m) => <option key={m} value={m} />)}</datalist>
      </div>
      <button className="btn-ghost text-xs" disabled={!settings.ai.configured.includes(route.provider)} onClick={() => provider.listModels().then(setModels).catch(() => setModels([]))}>
        List models
      </button>
    </div>
  );
}
