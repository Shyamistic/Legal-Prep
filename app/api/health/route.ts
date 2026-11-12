import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Reports which providers are configured (booleans only, never values). */
export async function GET() {
  return NextResponse.json({
    llm: Boolean(process.env.LLM_API_KEY),
    stt: Boolean(process.env.GNANI_API_KEY),
    tts: Boolean(process.env.GNANI_API_KEY),
    avatar: Boolean(process.env.ANAM_API_KEY),
  });
}
