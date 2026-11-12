import { NextResponse } from "next/server";
import { z } from "zod";
import { FEEDBACK_PROMPT, isDeliveryOnly } from "@/lib/guardrails";
import { chatCompletion, llmConfigured } from "@/lib/llm";
import { allow, clientKey, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  qa: z
    .array(z.object({ question: z.string().max(600), answer: z.string().max(3000) }))
    .min(1)
    .max(30),
});

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n))));

/** Scores clarity / directness / relevance from the transcript. Delivery only. */
export async function POST(req: Request) {
  if (!allow(clientKey(req, "feedback"), 10)) return tooMany();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!llmConfigured()) return NextResponse.json({ source: "heuristic" });

  const transcript = body.qa.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`).join("\n\n");
  try {
    const { text: raw } = await chatCompletion(
      [
        { role: "system", content: FEEDBACK_PROMPT },
        { role: "user", content: transcript },
      ],
      { maxTokens: 400, temperature: 0.2, json: true, timeoutMs: 20000 },
    );
    const j = JSON.parse(raw.replace(/^```json|```$/g, "").trim());
    const strings = (v: unknown) =>
      (Array.isArray(v) ? v : []).map(String).filter(isDeliveryOnly).slice(0, 3);
    const clarity = clamp(j.clarity);
    const directness = clamp(j.directness);
    const relevance = clamp(j.relevance);
    if ([clarity, directness, relevance].some(Number.isNaN)) throw new Error("bad scores");
    return NextResponse.json({
      source: "llm",
      clarity,
      directness,
      relevance,
      observations: strings(j.observations),
      tips: strings(j.tips),
    });
  } catch {
    return NextResponse.json({ source: "heuristic" });
  }
}
