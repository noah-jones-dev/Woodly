/**
 * Global app state (zustand). Only settings live here; projects are loaded
 * per page from the repo so there's one source of truth on disk.
 */
import { create } from "zustand";
import { repo } from "@/data/repo";
import { DEFAULT_SETTINGS, type Settings } from "@/data/types";
import { credentials } from "@/ai/transport";
import type { ProviderId } from "@/ai/types";

type State = {
  settings: Settings;
  loaded: boolean;
  load(): Promise<void>;
  update(fn: (s: Settings) => Settings): Promise<void>;
};

export const useApp = create<State>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const s = await repo.getSettings();
    // The keychain is the truth for which providers have keys.
    const configured: ProviderId[] = [];
    for (const p of ["anthropic", "openai", "gemini"] as ProviderId[]) if (await credentials.has(p).catch(() => false)) configured.push(p);
    set({ settings: { ...s, ai: { ...s.ai, configured } }, loaded: true });
  },
  async update(fn) {
    const next = fn(get().settings);
    set({ settings: next });
    await repo.saveSettings(next);
  },
}));
