import { NextResponse } from "next/server";
import { allow, clientKey, tooMany } from "@/lib/ratelimit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().min(1).max(500),
  speaker: z.enum(["judge", "counsel"]),
});

const VOICES = { judge: "Avinash", counsel: "Shivani" } as const;

/** Renders a single spoken line with Gnani Timbre. Only the line itself is sent. */
export async function POST(req: Request) {
  if (!allow(clientKey(req, "tts"), 40)) return tooMany();
  const key = process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: "Text-to-speech not configured" }, { status: 503 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
      body: JSON.stringify({
        text: body.text,
        voice: VOICES[body.speaker],
        model: "timbre-v3.0",
        language: "en-IN",
        speed: 0.95,
        audio_config: {
          sample_rate: 24000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: "mp3",
          bitrate: "64k",
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return NextResponse.json({ error: "Speech synthesis failed" }, { status: 502 });
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Speech synthesis unavailable" }, { status: 502 });
  }
}
