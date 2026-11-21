import { anthropicProvider } from "./providers/anthropic";
import { geminiProvider, openaiProvider } from "./providers/rest";
import type { AIProvider, AITask, CompletionRequest, ProviderId } from "./types";
import { AIError } from "./types";
import type { Settings } from "@/data/types";

/** Add a provider here and it shows up in Settings — nothing else changes. */
export const PROVIDERS: Record<ProviderId, AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

export function isTaskConfigured(settings: Settings, task: AITask) {
  return settings.ai.configured.includes(settings.ai.routes[task].provider);
}

export const aiAvailable = (settings: Settings) => isTaskConfigured(settings, "blueprint");

/** Run a completion on whichever provider/model the user routed this task to. */
export async function runTask(settings: Settings, task: AITask, req: Omit<CompletionRequest, "model">): Promise<{ text: string; origin: string }> {
  const route = settings.ai.routes[task];
  if (!settings.ai.configured.includes(route.provider))
    throw new AIError(`No API key for ${PROVIDERS[route.provider].name}. Add one in Settings → AI.`, "auth");
  const text = await PROVIDERS[route.provider].complete({ ...req, model: route.model });
  return { text, origin: `ai:${route.provider}/${route.model}` };
}

export * from "./types";
