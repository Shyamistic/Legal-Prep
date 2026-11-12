import "server-only";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Provider {
  name: string;
  base: string;
  key: string;
  model: string;
}

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.LLM_API_KEY) {
    list.push({
      name: "primary",
      base: (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
      key: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "gpt-4o-mini",
    });
  }
  // Optional second provider used automatically if the first is down or rate limited.
  if (process.env.LLM2_API_KEY && process.env.LLM2_BASE_URL) {
    list.push({
      name: "secondary",
      base: process.env.LLM2_BASE_URL.replace(/\/$/, ""),
      key: process.env.LLM2_API_KEY,
      model: process.env.LLM2_MODEL || "gpt-4o-mini",
    });
  }
  return list;
}

export function llmConfigured(): boolean {
  return providers().length > 0;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  ms: number;
  promptTokensEst: number;
}

class RetryableError extends Error {}

async function callOnce(
  p: Provider,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean; timeoutMs?: number },
): Promise<string> {
  // gpt-oss models spend part of the token budget on reasoning; keep it minimal.
  const reasoning = /gpt-oss/i.test(p.model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: (opts.maxTokens ?? 120) + (reasoning ? 300 : 0),
        ...(reasoning ? { reasoning_effort: "low" } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (res.status === 429 || res.status >= 500) throw new RetryableError(`LLM ${res.status}`);
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new RetryableError("LLM empty response");
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new RetryableError("LLM timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI-compatible chat completion with one quick retry on transient errors and
 * automatic failover to a secondary provider. Content is never logged.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean; timeoutMs?: number } = {},
): Promise<LlmResult> {
  const list = providers();
  if (!list.length) throw new Error("No LLM configured");
  const started = Date.now();
  const promptTokensEst = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);
  let lastErr: unknown;
  for (const p of list) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await callOnce(p, messages, opts);
        return { text, provider: p.name, model: p.model, ms: Date.now() - started, promptTokensEst };
      } catch (e) {
        lastErr = e;
        if (!(e instanceof RetryableError)) break; // permanent error: try next provider
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM failed");
}
