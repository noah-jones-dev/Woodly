export type ProviderId = "anthropic" | "openai" | "gemini";

/** Responsibilities that can be routed to different models (PRD §3 "AI Task Routing"). */
export type AITask = "text" | "reasoning" | "blueprint" | "vision";

export const TASK_LABELS: Record<AITask, { label: string; description: string }> = {
  text: { label: "Text & explanations", description: "Clarifying questions, the project assistant, lesson help." },
  reasoning: { label: "Reasoning & design review", description: "Revising designs and fixing validation problems." },
  blueprint: { label: "Blueprint generation", description: "Writing the structured project specification." },
  vision: { label: "Vision", description: "Analyzing photos you upload of your work." },
};

export type ImageInput = { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; base64: string };

export type ChatMessage = { role: "user" | "assistant"; text: string; images?: ImageInput[] };

export type CompletionRequest = {
  model: string;
  system: string;
  messages: ChatMessage[];
  /** Ask for a JSON-only reply where the provider supports it. */
  json?: boolean;
  maxTokens?: number;
  /** Reasoning depth hint; providers that don't support it ignore it. */
  effort?: "low" | "medium" | "high";
};

export interface AIProvider {
  id: ProviderId;
  name: string;
  keyHint: string;
  consoleUrl: string;
  defaultModel: string;
  suggestedModels: string[];
  complete(req: CompletionRequest): Promise<string>;
  listModels(): Promise<string[]>;
}

export class AIError extends Error {
  constructor(message: string, public readonly kind: "auth" | "refusal" | "rate" | "network" | "format" | "other" = "other") {
    super(message);
  }
}
