import { describe, expect, it } from "vitest";
import { chunkText, rank, retrieve, tokenize } from "../lib/rag";
import { WINDOW_TURNS, splitHistory, type HistoryTurn } from "../lib/context";
import { countFillers, summarise, makeMetric } from "../lib/metrics";

const statement = [
  "I rented a flat on Mill Road from March last year and paid a deposit of 900 pounds.",
  "The boiler broke in January. I reported it by email twice and nobody came for three weeks.",
  "I moved out on 12 March and left the keys with the agent. The agent said the carpet was damaged.",
  "No photographs of the carpet were ever sent to me.",
].join("\n\n");

describe("rag", () => {
  it("tokenizes without stop words", () => expect(tokenize("The deposit and the carpet")).toEqual(["deposit", "carpet"]));
  it("chunks long text under the target size", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about the flat.`).join(" ");
    const chunks = chunkText(long, 300, 40);
    expect(chunks.length).toBeGreaterThan(3);
    expect(Math.max(...chunks.map((c) => c.text.length))).toBeLessThan(420);
  });
  it("ranks the relevant passage first", () => {
    const top = rank(chunkText(statement, 120, 10), "was the boiler repaired?")[0];
    expect(top.chunk.text.toLowerCase()).toContain("boiler");
  });
  it("retrieve sends fewer characters than the whole statement", () => {
    const r = retrieve(statement.repeat(8), "what happened to the carpet", 2, 400);
    expect(r.usedChars).toBeLessThanOrEqual(400);
    expect(r.usedChars).toBeLessThan(r.totalChars);
  });
  it("falls back to the opening chunk when nothing matches", () => {
    expect(retrieve(statement, "zzzz qqqq").chunks.length).toBe(1);
  });
});

describe("context window", () => {
  const turns: HistoryTurn[] = Array.from({ length: 14 }, (_, i) => ({
    speaker: i % 2 === 0 ? "judge" : "you",
    text: `turn ${i} ${"x".repeat(300)}`,
  }));
  it("keeps short histories verbatim", () => {
    const h = splitHistory(turns.slice(0, 4));
    expect(h.summary).toBe("");
    expect(h.window.length).toBe(4);
  });
  it("summarises older turns and keeps a sliding window", () => {
    const h = splitHistory(turns);
    expect(h.window.length).toBe(WINDOW_TURNS);
    expect(h.summary).toContain("Earlier answer");
    expect(h.summary.length).toBeLessThan(1500);
  });
});

describe("metrics", () => {
  it("counts filler words", () => expect(countFillers("Um, I went, uh, to the shop, you know")).toBe(3));
  it("computes WPM from spoken answers", () => {
    const m = makeMetric("one two three four five six seven eight nine ten", { durationSec: 6, pauses: 0, longestPauseSec: 0 });
    expect(summarise([m]).wpm).toBe(100);
  });
  it("handles typed-only sessions", () => expect(summarise([makeMetric("typed answer here today")]).wpm).toBeNull());
});
