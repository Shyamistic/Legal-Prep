import "server-only";

/**
 * Small in-memory sliding-window limiter to blunt abuse of paid provider keys.
 * Per-instance only: on serverless each instance has its own counters, which is
 * acceptable for a demo. For production use a shared store (e.g. Upstash Redis).
 */
const hits = new Map<string, number[]>();

export function clientKey(req: Request, route: string): string {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  const ip = xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return `${route}:${ip}`;
}

export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    });
  }
  return true;
}

export const tooMany = () =>
  new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "30" },
  });
