import { NextResponse } from "next/server";
import { allow, clientKey, tooMany } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3_000_000; // ~90s of 16 kHz mono PCM; Gnani REST accepts <= 30s.

/** Proxies a short audio clip to Gnani Prisma STT. Audio is never stored or logged. */
export async function POST(req: Request) {
  if (!allow(clientKey(req, "stt"), 40)) return tooMany();
  const key = process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: "Speech-to-text not configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Invalid audio" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("audio_file", file, "answer.wav");
  upstream.append("language_code", "en-IN");
  upstream.append("model", process.env.GNANI_STT_MODEL || "prisma-v3.0");
  upstream.append("format", "transcribe");

  try {
    const res = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST",
      headers: { "X-API-Key-ID": key },
      body: upstream,
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }
    return NextResponse.json({ transcript: String(data.transcript ?? "") });
  } catch {
    return NextResponse.json({ error: "Transcription unavailable" }, { status: 502 });
  }
}
