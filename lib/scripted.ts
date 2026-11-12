import type { Speaker } from "./guardrails";

/**
 * Deterministic question bank. Used when no LLM key is configured, when the LLM
 * is unreachable, or when a generated line fails guardrail validation.
 * Every line is a familiarisation-style factual prompt: no advice, no merits.
 */
const JUDGE_BANK = [
  "Thank you. Could you tell the court, in your own words, what happened first?",
  "And what happened after that?",
  "Can you tell me roughly when that was?",
  "Where were you at that point?",
  "Who else was present at the time?",
  "Could you explain that a little more slowly for me?",
  "What did you do next?",
  "Is there anything you would like to add before we move on?",
];

const COUNSEL_BANK = [
  "Good morning. Can you confirm for the court when you first became aware of this matter?",
  "You mentioned that earlier. Could you tell us what you did immediately afterwards?",
  "Thank you. Who else knew about this at that time?",
  "Could you clarify how long that period lasted?",
  "Just so I understand, where did that take place?",
  "Thank you. Is there anything you wish to clarify about what you have told the court?",
];

export const OPENING: Record<Speaker, string> = {
  judge:
    "Good morning. Please take your seat, state your full name for the court, and tell me briefly why you are here today.",
  counsel: "Good morning. I will be asking you a few questions on behalf of the other side.",
};

export function scriptedLine(speaker: Speaker, turnIndex: number): string {
  const bank = speaker === "judge" ? JUDGE_BANK : COUNSEL_BANK;
  return bank[turnIndex % bank.length];
}

export const CLOSING_JUDGE =
  "Thank you. That concludes this practice hearing. You may now see feedback on your delivery.";
