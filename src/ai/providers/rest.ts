/**
 * OpenAI and Google Gemini providers via their REST APIs.
 *
 * Model names change often, so the model field is free text with
 * suggestions, and "List models" asks the provider what's available.
 */
import { secureFetch } from "../transport";
import { AIError, type AIProvider, type CompletionRequest } from "../types";

async function postJSON(provider: "openai" | "gemini", url: string, body: unknown) {
  let res: Response;
  try {
    res = await secureFetch(provider)(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AIError(`Couldn't reach ${provider}. Check your connection.`, "network");
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw new AIError(`${provider} rejected the API key.`, "auth");
  if (res.status === 429) throw new AIError(`Rate limited by ${provider} — wait and retry.`, "rate");
  if (!res.ok) throw new AIError(`${provider} error ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export const openaiProvider: AIProvider = {
  id: "openai",
  name: "OpenAI",
  keyHint: "sk-…",
  consoleUrl: "https://platform.openai.com/api-keys",
  defaultModel: "gpt-5",
  suggestedModels: ["gpt-5", "gpt-5-mini"],
  async complete(req: CompletionRequest) {
    const data = await postJSON("openai", "https://api.openai.com/v1/chat/completions", {
      model: req.model,
      max_completion_tokens: req.maxTokens ?? 16000,
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({
          role: m.role,
          content: [
            ...(m.images ?? []).map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.base64}` } })),
            { type: "text", text: m.text },
          ],
        })),
      ],
    });
    const choice = data.choices?.[0];
    if (choice?.message?.refusal) throw new AIError(choice.message.refusal, "refusal");
    return choice?.message?.content ?? "";
  },
  async listModels() {
    const res = await secureFetch("openai")("https://api.openai.com/v1/models");
    if (!res.ok) throw new AIError(`OpenAI error ${res.status}`, res.status === 401 ? "auth" : "other");
    return ((await res.json()).data as { id: string }[]).map((m) => m.id).sort();
  },
};

export const geminiProvider: AIProvider = {
  id: "gemini",
  name: "Google Gemini",
  keyHint: "AIza…",
  consoleUrl: "https://aistudio.google.com/apikey",
  defaultModel: "gemini-2.5-pro",
  suggestedModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
  async complete(req: CompletionRequest) {
    const model = encodeURIComponent(req.model);
    const data = await postJSON("gemini", `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [...(m.images ?? []).map((i) => ({ inline_data: { mime_type: i.mediaType, data: i.base64 } })), { text: m.text }],
      })),
      generationConfig: { maxOutputTokens: req.maxTokens ?? 16000, ...(req.json ? { responseMimeType: "application/json" } : {}) },
    });
    const cand = data.candidates?.[0];
    if (!cand) throw new AIError(data.promptFeedback?.blockReason ? `Blocked: ${data.promptFeedback.blockReason}` : "Empty response", "refusal");
    return (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  },
  async listModels() {
    const res = await secureFetch("gemini")("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100");
    if (!res.ok) throw new AIError(`Gemini error ${res.status}`, res.status === 403 ? "auth" : "other");
    return ((await res.json()).models as { name: string }[]).map((m) => m.name.replace(/^models\//, ""));
  },
};
