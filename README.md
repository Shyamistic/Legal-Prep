# LegalPrep

A virtual courtroom for practising a hearing in England & Wales. It gives familiarisation and feedback on **delivery only**. It never gives legal advice.

Not affiliated with any real product. This is an independent demonstration build.

## What it does
1. Tour of the courtroom and who is who.
2. Prep Room: optional witness statement (`.txt`/`.md`) and case summary, hearing type, question style.
3. Hearing: a live Digital Judge avatar (and optional opposing counsel). Answer by voice or typing.
4. Feedback: pace (WPM), filler words, pauses, clarity / directness / relevance, optional eye contact, answer-by-answer table, printable.

## Architecture
```
Browser (memory only)                 Next.js API routes (stateless)            Providers
 mic -> WAV 16 kHz  ---------------->  /api/stt   ---------------------------->  Gnani Prisma (STT)
 BM25 over statement -> top-k passages
 question + history + passages ------>  /api/chat  -- guardrails -- LLM chain ->  OpenAI-compatible (primary, secondary)
 judge line ---------------------------------------------------------------->  Anam avatar (render-only, mic disabled)
 counsel line ------------------------>  /api/tts   ---------------------------->  Gnani Timbre (TTS)
 camera -> MediaPipe (on device only, never uploaded)
```

### Conversation context management
Three layers keep latency and cost flat as a hearing grows (`lib/context.ts`):
1. **Pinned**: persona rules, hearing type and style, case brief, retrieved passages.
2. **Rolling summary**: older turns compressed deterministically (no extra model call).
3. **Sliding window**: the last 6 turns verbatim.

### Ephemeral RAG (`lib/rag.ts`)
Papers must never be persisted, so there is no vector store to write to. The statement is chunked in the browser, ranked with BM25 against the latest answer and question, and **only the top passages** are sent to the model. This reduces the sensitive text leaving the device, prompt size, latency and cost, and leaves no index to delete.

### Guardrails (`lib/guardrails.ts`)
- Input screen for requests for advice (fixed refusal, no model call).
- Persona prompts forbid advice, merits and law.
- Deterministic output validator on every generated line (two sentences max, blocklist for advice / merits / citations), one regeneration, then a scripted fallback.
- Feedback strings are filtered to delivery-only.

### Reliability and cost
- One quick retry on 429 / 5xx / timeout, then automatic failover to a secondary LLM (`LLM2_*`).
- Avatar falls back to the previous look, then to voice-only; STT failure falls back to typing.
- Per-IP rate limits on every route (in-memory; use Redis for multi-instance production).
- Content-free timing panel: add `?debug=1` to `/hearing`.
- Security headers (CSP, HSTS, Permissions-Policy) in `next.config.mjs`.

### Privacy by design
No accounts, database, cookies or analytics. Papers, transcript and scores live in JS memory and clear on refresh. API routes never log content. Camera frames never leave the browser.

## Run locally
```
cp .env.example .env.local     # add keys
npm install
npm run dev
npm test                        # 31 unit tests
```

## Deploy (Vercel)
1. Push to GitHub (`.env.local` is git-ignored; only `.env.example` is committed).
2. Import the repo in Vercel (framework: Next.js, no config needed).
3. Add environment variables from `.env.example` (at least `ANAM_API_KEY`, `GNANI_API_KEY`, `LLM_*`).
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed URL.

## Roadmap (what production would add)
- Embedding retrieval (pgvector) over a public procedure-guidance corpus for procedural familiarisation.
- Streaming LLM tokens into the avatar sentence by sentence to cut time to first word.
- Accounts, session credits (Stripe), reminders (Resend), deletion jobs.
- Redis-backed rate limiting, tracing and cost dashboards.
- Custom judge avatar in a courtroom setting.
