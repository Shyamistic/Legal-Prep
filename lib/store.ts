"use client";

import { useSyncExternalStore } from "react";

/**
 * Ephemeral session store. Lives in JavaScript memory only: never written to
 * localStorage, cookies, IndexedDB or any server. A page refresh clears it.
 */
export type TurnSpeaker = "judge" | "counsel" | "you";

export interface Turn {
  id: string;
  speaker: TurnSpeaker;
  text: string;
}

export interface AnswerMetric {
  durationSec: number; // speaking time, leading/trailing silence trimmed
  words: number;
  fillers: number;
  pauses: number; // silences >= 0.9s inside the answer
  longestPauseSec: number;
  spoken: boolean; // false when typed
}

export interface TurnTiming {
  turn: number;
  sttMs?: number;
  chatMs: number; // round trip to /api/chat
  llmMs?: number; // model time reported by the server
  source: string;
  provider?: string;
  promptTokensEst?: number;
  passages?: number;
  summarised?: boolean;
}

export interface SessionState {
  hearingType: "civil" | "small-claims" | "family" | "employment" | "tenancy";
  style: "gentle" | "standard" | "probing";
  timings: TurnTiming[];
  caseSummary: string;
  statementName: string;
  statementText: string;
  includeCounsel: boolean;
  cameraOn: boolean;
  turns: Turn[];
  answers: AnswerMetric[];
  eye: { looking: number; total: number };
  ended: boolean;
}

const initial: SessionState = {
  hearingType: "civil",
  style: "standard",
  timings: [],
  caseSummary: "",
  statementName: "",
  statementText: "",
  includeCounsel: true,
  cameraOn: false,
  turns: [],
  answers: [],
  eye: { looking: 0, total: 0 },
  ended: false,
};

let state: SessionState = initial;
const listeners = new Set<() => void>();

export const session = {
  get: () => state,
  set(patch: Partial<SessionState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  update(fn: (s: SessionState) => Partial<SessionState>) {
    state = { ...state, ...fn(state) };
    listeners.forEach((l) => l());
  },
  /** Purge everything: papers, transcript, metrics. */
  clear() {
    state = initial;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, () => initial);
}
