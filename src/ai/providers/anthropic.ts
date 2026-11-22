/**
 * Anthropic (Claude) provider — official SDK, routed through secureFetch so
 * the API key stays in the OS keychain.
 */
import Anthropic from "@anthropic-ai/sdk";
import { secureFetch } from "../transport";
import { AIError, type AIProvider, type CompletionRequest } from "../types";

// Models that accept the server-side refusal fallback parameter.
const FALLBACK_MODELS = /^claude-(fable-5-[12]|opus-5-5|opus-5|sonnet-5-5)$/;
// Claude 5-family models take `output_config.effort`.
const EFFORT_MODELS = /^claude-(opus|sonnet|haiku|fable|mythos)-5/;

function client() {
  return new Anthropic({
    apiKey: "stored-in-os-keychain", // placeholder; the real key is injected by the transport
    fetch: secureFetch("anthropic"),
    dangerouslyAllowBrowser: true, // safe here: no real key exists in the webview
    maxRetries: 2,
  });
}

export const anthropicProvider: AIProvider = {
  id: "anthropic",
  name: "Anthropic (Claude)",
  keyHint: "sk-ant-…",
  consoleUrl: "https://console.anthropic.com/settings/keys",
  defaultModel: "claude-opus-5-5",
  suggestedModels: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"],

  async complete(req: CompletionRequest) {
    const messages: Anthropic.Beta.BetaMessageParam[] = req.messages.map((m) => ({
      role: m.role,
      content: [
        ...(m.images ?? []).map(
          (img): Anthropic.Beta.BetaImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.base64 },
          }),
        ),
        { type: "text" as const, text: m.text },
      ],
    }));
    const useFallback = FALLBACK_MODELS.test(req.model);
    try {
      // Stream, then collect the final message: the SDK refuses large
      // non-streaming requests (they can outlive HTTP timeouts).
      const res = await client()
        .beta.messages.stream({
          model: req.model,
          max_tokens: req.maxTokens ?? 16000,
          system: req.system,
          messages,
          ...(EFFORT_MODELS.test(req.model) && req.effort ? { output_config: { effort: req.effort } } : {}),
          ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        })
        .finalMessage();
      if (res.stop_reason === "refusal")
        throw new AIError(`The model declined this request${res.stop_details?.explanation ? `: ${res.stop_details.explanation}` : "."}`, "refusal");
      if (res.stop_reason === "max_tokens") throw new AIError("The response was cut off (too long). Try a simpler request.", "format");
      return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("Anthropic rejected the API key.", "auth");
      if (e instanceof Anthropic.RateLimitError) throw new AIError("Rate limited by Anthropic — wait a moment and retry.", "rate");
      if (e instanceof Anthropic.APIConnectionError) throw new AIError("Couldn't reach Anthropic. Check your connection.", "network");
      if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic error ${e.status}: ${e.message}`);
      throw e;
    }
  },

  async listModels() {
    const out: string[] = [];
    for await (const m of client().models.list()) out.push(m.id);
    return out;
  },
};
