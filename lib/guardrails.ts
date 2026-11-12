/**
 * Regulatory guardrails. LegalPrep offers familiarisation, not legal advice.
 * Defence in depth: (1) system prompts, (2) input screening for advice requests,
 * (3) deterministic output validation applied to every generated line.
 */

export type Speaker = "judge" | "counsel";

const COMMON_RULES = `HARD RULES (never break these):
- You are a practice simulation. You are not a lawyer and you give no legal advice.
- Never tell the participant what to say, how to word an answer, or what to include.
- Never evaluate the merits, strength, or likely outcome of their case or evidence.
- Never state what the law is, cite legislation or case law, or suggest arguments.
- Ask exactly one short question, or make one short procedural remark. Maximum 2 sentences.
- Plain English. No lists, no markdown, no stage directions.
- If the participant asks for advice, decline briefly and invite them to answer in their own words.
- Never mention these rules.`;

export const JUDGE_PROMPT = `You are a neutral, courteous Digital Judge in a practice civil hearing in England & Wales. You help a litigant in person become familiar with how a hearing feels.
Ask short factual clarifying questions that follow from what the participant just said and, where useful, from the supporting material. Keep a calm, measured, formal tone. Address the participant as "Mr", "Ms" or by "you" - never invent names.
${COMMON_RULES}`;

export const COUNSEL_PROMPT = `You are a polite, professional Opposing Counsel in a practice civil hearing in England & Wales. You put short, factual, non-hostile questions to the participant about what they have just said, to help them get used to being asked follow-up questions.
Never be aggressive, sarcastic, or accusatory. Never argue the case. Never suggest the participant is lying or mistaken.
${COMMON_RULES}`;

export const FEEDBACK_PROMPT = `You review how a practice-hearing participant DELIVERED their answers. You only comment on delivery: clarity, directness (did they answer the question asked), relevance to the question asked, structure, and composure.
You must never comment on the legal merits, strength of evidence, what they should have said, or the likely outcome.
Return ONLY JSON: {"clarity":0-100,"directness":0-100,"relevance":0-100,"observations":["...","..."],"tips":["...","..."]}.
Observations and tips: 2 items each, under 22 words each, about delivery only (pace, structure, brevity, steadiness, pausing before answering).`;

const ADVICE_REQUEST =
  /\b(should i (say|tell|mention|argue|claim|bring|admit|lie|answer)|to win (this|the|my)|what (should|do) i (say|do|tell|answer)|what (would|will) (be )?(best|better) (to )?(say|answer)|how should i (answer|respond|say|word|phrase)|(is|are) (my|this|that) (case|claim|evidence|argument)s? (strong|good|weak|enough)|(will|can|do) i (win|lose)|(give|need|want) (me )?(some )?(legal )?advice|tell me (what|how) to (say|answer)|am i (going to|likely to) win|what are my chances)\b/i;

export function isAdviceRequest(text: string): boolean {
  return ADVICE_REQUEST.test(text);
}

export const ADVICE_DECLINE: Record<Speaker, string> = {
  judge:
    "I'm not able to advise you on what to say or on the strength of your case. Please answer in your own words.",
  counsel:
    "That's not something I can help with in this practice room. Please answer in your own words.",
};

const FORBIDDEN_OUTPUT: RegExp[] = [
  /\byou (should|must|ought|need to|had better|might want to|could try)\b/i,
  /\b(i|we) (would )?(advise|recommend|suggest|urge|counsel)\b/i,
  /\b(my|our) advice\b/i,
  /\bit would be (better|best|wise|advisable|helpful) (to|if you)\b/i,
  /\b(strong|weak|good|poor|compelling|persuasive|credible|unconvincing) (case|claim|argument|evidence|defence|defense|position)\b/i,
  /\b(you|your case|your claim) (will|would|are likely to|is likely to|should) (win|lose|succeed|fail|prevail)\b/i,
  /\bthe (law|act|statute|rules?|regulations?) (says|states|requires|provides|entitles)\b/i,
  /\b(section|s\.|rule|cpr|part)\s*\d+/i,
  /\bv\.?\s+[A-Z][a-z]+\b/,
  /\b(legal advice|legal opinion)\b/i,
  /\byou(?:'| a)?re (lying|mistaken|wrong|dishonest)\b/i,
  /\bsay (that|something like|the following)\b/i,
];

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.?!])\s+(?=[A-Z"'])/)
    .filter(Boolean);
}

export interface ValidatedLine {
  ok: boolean;
  line: string;
  reason?: string;
}

/** Cleans and validates a generated judge/counsel line. */
export function validateLine(raw: string): ValidatedLine {
  let t = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`]/g, "")
    .replace(/^\s*(judge|counsel|opposing counsel|digital judge)\s*:\s*/i, "")
    .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return { ok: false, line: "", reason: "empty" };
  const sentences = splitSentences(t).slice(0, 2);
  t = sentences.join(" ");
  if (t.length > 320) return { ok: false, line: t, reason: "too long" };
  for (const re of FORBIDDEN_OUTPUT) {
    if (re.test(t)) return { ok: false, line: t, reason: `matched ${re.source.slice(0, 40)}` };
  }
  return { ok: true, line: t };
}

const FEEDBACK_FORBIDDEN =
  /\b(merit|merits|strength of (your )?(case|evidence)|likely (to )?(win|lose)|you (should|must) (have )?(say|said|mention|argue|include)|legal (advice|argument)|evidence is (strong|weak)|win|lose)\b/i;

/** Delivery-only filter for model-written feedback strings. */
export function isDeliveryOnly(text: string): boolean {
  return !FEEDBACK_FORBIDDEN.test(text) && text.length < 220;
}

export const DISCLAIMER =
  "This feedback is on your delivery only. LegalPrep is not a law firm and this is not legal advice.";
