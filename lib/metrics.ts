import type { AnswerMetric } from "./store";
import { countWords } from "./utils";

const FILLER_RE = /\b(um+|uh+|er+m?|erm|ah+|hmm+|you know|sort of|kind of|i mean)\b/gi;

export function countFillers(text: string): number {
  return (text.match(FILLER_RE) ?? []).length;
}

export function makeMetric(
  text: string,
  rec?: { durationSec: number; pauses: number; longestPauseSec: number },
): AnswerMetric {
  return {
    durationSec: rec?.durationSec ?? 0,
    words: countWords(text),
    fillers: countFillers(text),
    pauses: rec?.pauses ?? 0,
    longestPauseSec: rec?.longestPauseSec ?? 0,
    spoken: Boolean(rec),
  };
}

export interface Summary {
  wpm: number | null;
  paceLabel: string;
  paceScore: number;
  fillerRate: number; // per 100 words
  fillerLabel: string;
  pausesPerAnswer: number;
  pauseLabel: string;
  avgWords: number;
  answers: number;
}

export function summarise(answers: AnswerMetric[]): Summary {
  const spoken = answers.filter((a) => a.spoken && a.durationSec > 1.5 && a.words >= 3);
  const totalWords = answers.reduce((n, a) => n + a.words, 0);
  const fillers = answers.reduce((n, a) => n + a.fillers, 0);
  const dur = spoken.reduce((n, a) => n + a.durationSec, 0);
  const words = spoken.reduce((n, a) => n + a.words, 0);
  const wpm = dur > 0 ? Math.round((words / dur) * 60) : null;

  let paceLabel = "Not enough spoken answers to measure";
  let paceScore = 0;
  if (wpm !== null) {
    if (wpm < 90) {
      paceLabel = "On the slow side: steady, but try keeping a little momentum";
      paceScore = 65;
    } else if (wpm <= 150) {
      paceLabel = "Good steady pace";
      paceScore = 92;
    } else if (wpm <= 175) {
      paceLabel = "A little fast: slowing slightly helps the court follow";
      paceScore = 72;
    } else {
      paceLabel = "Fast: take a breath between points";
      paceScore = 55;
    }
  }

  const fillerRate = totalWords ? (fillers / totalWords) * 100 : 0;
  const fillerLabel =
    fillerRate < 1.5 ? "Few filler words detected" : fillerRate < 4 ? "Some filler words" : "Frequent filler words";
  const pauses = answers.reduce((n, a) => n + a.pauses, 0);
  const pausesPerAnswer = answers.length ? pauses / answers.length : 0;
  const pauseLabel =
    pausesPerAnswer < 0.6
      ? "Smooth flow with few long pauses"
      : pausesPerAnswer < 1.6
        ? "Natural pausing"
        : "Several long pauses: it's fine to take a moment, then continue";

  return {
    wpm,
    paceLabel,
    paceScore,
    fillerRate,
    fillerLabel,
    pausesPerAnswer,
    pauseLabel,
    avgWords: answers.length ? Math.round(totalWords / answers.length) : 0,
    answers: answers.length,
  };
}

/** Heuristic delivery scores used when no LLM is configured. */
export function heuristicScores(
  s: Summary,
  qa: { question: string; answer: string }[],
): { clarity: number; directness: number; relevance: number } {
  const clarity = Math.max(35, Math.round(96 - s.fillerRate * 6 - s.pausesPerAnswer * 5));
  const avg = s.avgWords;
  const directness = avg === 0 ? 0 : avg < 4 ? 55 : avg <= 70 ? 88 : avg <= 110 ? 74 : 60;
  const q = qa.map((t) => new Set(t.question.toLowerCase().match(/[a-z]{5,}/g) ?? []));
  let overlap = 0;
  qa.forEach((t, i) => {
    const aw = new Set(t.answer.toLowerCase().match(/[a-z]{5,}/g) ?? []);
    if (Array.from(q[i]).some((w) => aw.has(w))) overlap++;
  });
  const relevance = qa.length ? Math.round(70 + (overlap / qa.length) * 20) : 0;
  return { clarity, directness, relevance };
}

export function eyeContactPercent(eye: { looking: number; total: number }): number | null {
  if (eye.total < 20) return null;
  return Math.round((eye.looking / eye.total) * 100);
}

