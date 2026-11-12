/**
 * Ephemeral, in-memory retrieval over the participant's own papers.
 *
 * Why this shape: the papers must never be persisted (they live in browser memory
 * and are cleared when the session ends), so there is no vector database to
 * write to. Instead we chunk the statement locally, rank chunks with BM25 against
 * the current question/answer, and send ONLY the top-k chunks to the model.
 * Benefits: less sensitive text leaves the device, smaller prompts, lower latency
 * and cost, and no index to delete afterwards.
 *
 * BM25 is lexical. For a longer-term corpus (e.g. public procedure guidance) the
 * same interface can be backed by pgvector + embeddings; see README "Roadmap".
 */

export interface Chunk {
  id: number;
  text: string;
}

const STOP = new Set(
  "the and for that with this have from they were was are but not you your had has his her she him its our out about into than then them been would could should there their what when where which while who will also very just over only some such more most other any can did does done say said told".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));
}

/** Paragraph-aware chunking with a small overlap so facts spanning a boundary survive. */
export function chunkText(text: string, target = 600, overlap = 80): Chunk[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/).flatMap((p) => {
    if (p.length <= target) return [p];
    const sentences = p.split(/(?<=[.!?])\s+/);
    const out: string[] = [];
    let cur = "";
    for (const s of sentences) {
      if ((cur + " " + s).length > target && cur) {
        out.push(cur.trim());
        cur = cur.slice(-overlap) + " " + s;
      } else cur += " " + s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  });
  const chunks: Chunk[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && (buf + "\n" + p).length > target) {
      chunks.push({ id: chunks.length, text: buf.trim() });
      buf = buf.slice(-overlap) + "\n" + p;
    } else buf = buf ? buf + "\n" + p : p;
  }
  if (buf.trim()) chunks.push({ id: chunks.length, text: buf.trim() });
  return chunks;
}

/** Okapi BM25 ranking. Returns chunks ordered best-first, with scores. */
export function rank(chunks: Chunk[], query: string, k1 = 1.4, b = 0.75): { chunk: Chunk; score: number }[] {
  const q = Array.from(new Set(tokenize(query)));
  if (!chunks.length || !q.length) return [];
  const docs = chunks.map((c) => tokenize(c.text));
  const avgLen = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of Array.from(new Set(d))) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  return chunks
    .map((chunk, i) => {
      const d = docs[i];
      const tf = new Map<string, number>();
      for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      for (const term of q) {
        const f = tf.get(term) ?? 0;
        if (!f) continue;
        const n = df.get(term) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen));
      }
      return { chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b2) => b2.score - a.score);
}

export interface Retrieval {
  chunks: string[];
  totalChunks: number;
  usedChars: number;
  totalChars: number;
}

/** Selects the most relevant passages for the next question. Falls back to the opening chunk. */
export function retrieve(statement: string, query: string, k = 3, maxChars = 2400): Retrieval {
  const chunks = chunkText(statement);
  const ranked = rank(chunks, query).slice(0, k);
  const picked = (ranked.length ? ranked.map((r) => r.chunk) : chunks.slice(0, 1)).sort((a, b) => a.id - b.id);
  const out: string[] = [];
  let used = 0;
  for (const c of picked) {
    if (used + c.text.length > maxChars) break;
    out.push(c.text);
    used += c.text.length;
  }
  return { chunks: out, totalChunks: chunks.length, usedChars: used, totalChars: statement.length };
}
