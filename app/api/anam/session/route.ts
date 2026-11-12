import { NextResponse } from "next/server";
import { allow, clientKey, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A mature, grey-haired man in a suit, paired with a polished formal British voice.
const JUDGE = {
  avatarId: "19d18eb0-5346-4d50-a77f-26b3723ed79d", // Anam stock avatar "Richard"
  voiceId: "c48d5f11-5050-11f1-9076-5e955d484d11", // "Benedict - Measured Mediator" (British, formal)
};
// Known-good default used if the judge look fails to start.
const FALLBACK = {
  avatarId: "071b0286-4cce-4808-bee2-e642f1062de3",
  voiceId: "de23e340-1416-4dd8-977d-065a7ca11697",
};

/**
 * Creates an Anam session token for a render-only judge avatar.
 * llmId CUSTOMER_CLIENT_V1 disables Anam's own "brain": our backend writes the
 * judge's lines and the client sends only those lines to the avatar.
 */
export async function POST(req: Request) {
  if (!allow(clientKey(req, "anam"), 10)) return tooMany();
  const key = process.env.ANAM_API_KEY;
  if (!key) return NextResponse.json({ error: "Avatar not configured" }, { status: 503 });
  const fallback = new URL(req.url).searchParams.get("fallback") === "1";
  const look = fallback ? FALLBACK : JUDGE;
  try {
    const res = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        personaConfig: {
          name: "Digital Judge",
          avatarId: process.env.ANAM_AVATAR_ID || look.avatarId,
          avatarModel: process.env.ANAM_AVATAR_MODEL || "cara-4",
          voiceId: process.env.ANAM_VOICE_ID || look.voiceId,
          llmId: "CUSTOMER_CLIENT_V1",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ error: "Avatar session failed" }, { status: 502 });
    const data = await res.json();
    return NextResponse.json({ sessionToken: data.sessionToken }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Avatar unavailable" }, { status: 502 });
  }
}
