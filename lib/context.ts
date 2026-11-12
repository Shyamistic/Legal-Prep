/**
 * Conversation context management for the courtroom.
 *
 * Three layers, so latency and cost stay flat however long a hearing runs:
 *  1. Pinned: persona rules + hearing type/style + case brief + retrieved passages.
 *  2. Rolling summary: older turns compressed deterministically (no extra LLM call,
 *     no added latency; participant answers are truncated, questions are dropped).
 *  3. Sliding window: the last few turns verbatim for natural follow-ups.
 */

export interface HistoryTurn {
  speaker: "judge" | "counsel" | "you";
  text: string;
}

export const WINDOW_TURNS = 6;

export function compressOlder(turns: HistoryTurn[]): string {
  const answers = turns.filter((t) => t.speaker === "you").map((t) => t.text.replace(/\s+/g, " ").trim());
  if (!answers.length) return "";
  const bullets = answers.slice(-8).map((a, i) => `- Earlier answer ${i + 1}: ${a.length > 140 ? a.slice(0, 137) + "..." : a}`);
  return `Summary of the earlier part of the hearing (participant's answers, shortened):\n${bullets.join("\n")}\nDo not repeat questions already covered.`;
}

export function splitHistory(history: HistoryTurn[]) {
  if (history.length <= WINDOW_TURNS) return { summary: "", window: history };
  const cut = history.length - WINDOW_TURNS;
  return { summary: compressOlder(history.slice(0, cut)), window: history.slice(cut) };
}

/** Rough token estimate (about 4 characters per token for English). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

export type HearingType = "civil" | "small-claims" | "family" | "employment" | "tenancy";
export type QuestionStyle = "gentle" | "standard" | "probing";

export const HEARING_TYPES: Record<HearingType, { label: string; blurb: string; prompt: string }> = {
  civil: {
    label: "Civil claim",
    blurb: "A general county court hearing.",
    prompt: "a civil claim in the County Court",
  },
  "small-claims": {
    label: "Small claims",
    blurb: "Less formal, shorter, focused on facts.",
    prompt: "a small claims hearing, which is relatively informal and fact-focused",
  },
  family: {
    label: "Family",
    blurb: "A calm, careful tone throughout.",
    prompt: "a family court hearing; be especially gentle, calm and respectful, and avoid anything intrusive",
  },
  employment: {
    label: "Employment tribunal",
    blurb: "Questions about events and timelines at work.",
    prompt: "an employment tribunal hearing; focus on the sequence of events and dates",
  },
  tenancy: {
    label: "Housing / tenancy",
    blurb: "Questions about the property and what happened.",
    prompt: "a housing or tenancy hearing; focus on what happened and when",
  },
};

export const STYLES: Record<QuestionStyle, { label: string; blurb: string; prompt: string }> = {
  gentle: { label: "Gentle", blurb: "Short, open, reassuring.", prompt: "Style: gentle. Use short, open, reassuring questions and allow time." },
  standard: { label: "Standard", blurb: "A realistic, even pace.", prompt: "Style: standard. Ask clear, direct factual questions at an even pace." },
  probing: {
    label: "Probing",
    blurb: "More follow-ups on detail and dates.",
    prompt: "Style: probing but always courteous. Ask for specific detail such as dates, places and order of events. Never hostile.",
  },
};
