"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Eye, Loader2, Mic, Printer, RotateCcw } from "lucide-react";
import { Button, linkButtonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/guardrails";
import { eyeContactPercent, heuristicScores, summarise } from "@/lib/metrics";
import { session, useSession } from "@/lib/store";

interface Scores {
  clarity: number;
  directness: number;
  relevance: number;
  observations: string[];
  tips: string[];
  source: "llm" | "heuristic";
}

function Meter({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-parchment-100">{label}</span>
        <span className="font-serif text-lg">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700" role="img" aria-label={`${label} ${value} out of 100`}>
        <div className="h-full rounded-full bg-gradient-to-r from-brass-500 to-brass-300" style={{ width: `${value}%` }} />
      </div>
      {note && <p className="mt-1.5 text-xs text-parchment-400">{note}</p>}
    </div>
  );
}

export default function Feedback() {
  const s = useSession();
  const summary = useMemo(() => summarise(s.answers), [s.answers]);
  const eye = eyeContactPercent(s.eye);
  const qa = useMemo(() => {
    const out: { question: string; answer: string }[] = [];
    s.turns.forEach((t, i) => {
      if (t.speaker === "you") {
        const q = [...s.turns.slice(0, i)].reverse().find((x) => x.speaker !== "you");
        out.push({ question: q?.text ?? "", answer: t.text });
      }
    });
    return out;
  }, [s.turns]);

  const [scores, setScores] = useState<Scores | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (qa.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const fallback = (): Scores => ({
      ...heuristicScores(summary, qa),
      observations: [],
      tips: [],
      source: "heuristic",
    });
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qa }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setScores(j?.source === "llm" ? (j as Scores) : fallback());
      })
      .catch(() => !cancelled && setScores(fallback()))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qa.length]);

  if (s.answers.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-serif text-3xl">No hearing to review yet.</h1>
        <p className="mt-3 text-parchment-200">
          Feedback is held in this tab only and clears when you close it. Start a practice hearing to see
          how your delivery came across.
        </p>
        <Link href="/prep" className={linkButtonClasses("primary", "lg", "mt-6")}>Go to the Prep Room</Link>
      </div>
    );
  }

  return (
    <div className="py-8">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-400">Step 04</p>
      <h1 className="mt-2 font-serif text-4xl">Feedback on your delivery.</h1>
      <p className="mt-3 max-w-2xl text-parchment-200">
        You answered {summary.answers} question{summary.answers === 1 ? "" : "s"}. This is how your delivery
        came across, never what you should have said.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Mic className="h-4 w-4 text-brass-400" aria-hidden /> Speaking pace</CardTitle></CardHeader>
          <CardContent>
            <p className="font-serif text-4xl">{summary.wpm ?? "-"}<span className="ml-1 text-base text-parchment-400">WPM</span></p>
            <p className="mt-2 text-sm text-parchment-200">{summary.paceLabel}</p>
            <p className="mt-3 text-xs text-parchment-400">A calm pace for giving evidence is usually around 110-150 words per minute.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Clarity &amp; pauses</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-parchment-200">
            <p>{summary.fillerLabel} <span className="text-parchment-400">({summary.fillerRate.toFixed(1)} per 100 words)</span></p>
            <p>{summary.pauseLabel} <span className="text-parchment-400">({summary.pausesPerAnswer.toFixed(1)} long pauses per answer)</span></p>
            <p>Average answer length: {summary.avgWords} words</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-4 w-4 text-brass-400" aria-hidden /> Eye contact</CardTitle></CardHeader>
          <CardContent>
            {eye === null ? (
              <p className="text-sm text-parchment-200">
                {s.cameraOn ? "Not enough camera samples to estimate." : "Camera was off. That's completely fine, it's optional."}
              </p>
            ) : (
              <>
                <p className="font-serif text-4xl">{eye}%</p>
                <p className="mt-2 text-sm text-parchment-200">
                  {eye >= 75 ? "Steady, settled eye contact" : eye >= 50 ? "Mostly steady, with natural glances away" : "Try resting your gaze toward the screen a little more"}
                </p>
                <p className="mt-3 text-xs text-parchment-400">Approximate, estimated on your device. No face data was kept.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Clarity, directness &amp; relevance
            {loading && <Loader2 className="h-4 w-4 animate-spin text-parchment-400" aria-label="Scoring" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scores ? (
            <div className="grid gap-6 md:grid-cols-3">
              <Meter label="Clarity" value={scores.clarity} />
              <Meter label="Directness" value={scores.directness} note="Did you answer the question asked?" />
              <Meter label="Relevance" value={scores.relevance} note="To the question put to you." />
              {(scores.observations.length > 0 || scores.tips.length > 0) && (
                <div className="grid gap-6 text-sm md:col-span-3 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 font-medium text-parchment-50">What we noticed</h3>
                    <ul className="list-disc space-y-1 pl-5 text-parchment-200">{scores.observations.map((o) => <li key={o}>{o}</li>)}</ul>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium text-parchment-50">For next time (delivery)</h3>
                    <ul className="list-disc space-y-1 pl-5 text-parchment-200">{scores.tips.map((o) => <li key={o}>{o}</li>)}</ul>
                  </div>
                </div>
              )}
              <p className="text-xs text-parchment-400 md:col-span-3">
                Scores are automatic and affect only the feedback you see. If one seems wrong, take it with a pinch of salt: it is a practice aid, not an assessment.
              </p>
            </div>
          ) : (
            <p className="text-sm text-parchment-400">Preparing your scores...</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader><CardTitle>Answer by answer</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">Delivery measures for each answer</caption>
              <thead className="text-parchment-400">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">#</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Pace</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Words</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Fillers</th>
                  <th scope="col" className="py-2 font-medium">Long pauses</th>
                </tr>
              </thead>
              <tbody>
                {s.answers.map((a, i) => {
                  const wpm = a.spoken && a.durationSec > 1.5 ? Math.round((a.words / a.durationSec) * 60) : null;
                  return (
                    <tr key={i} className="border-t border-ink-700">
                      <td className="py-2 pr-4 text-parchment-400">{i + 1}</td>
                      <td className="py-2 pr-4">
                        {wpm === null ? (
                          <span className="text-parchment-400">{a.spoken ? "too short" : "typed"}</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2 w-24 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                              <span
                                className="block h-full bg-brass-400"
                                style={{ width: `${Math.min(100, Math.round((wpm / 200) * 100))}%` }}
                              />
                            </span>
                            {wpm} WPM
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{a.words}</td>
                      <td className="py-2 pr-4">{a.fillers}</td>
                      <td className="py-2">{a.pauses}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="h-4 w-4 text-brass-400" aria-hidden /> Before the day</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-parchment-200 md:grid-cols-2">
            <li>- Plan your journey and aim to arrive early.</li>
            <li>- Bring your papers and anything the court asked you to bring.</li>
            <li>- Switch your phone to silent before you go in.</li>
            <li>- Take a slow breath before answering. It&apos;s fine to ask for a question to be repeated.</li>
          </ul>
          <p className="mt-3 text-xs text-parchment-400">General reminders only. Follow your court&apos;s own instructions.</p>
        </CardContent>
      </Card>

      <p className="mt-8 rounded-xl border border-ink-600 bg-ink-800/60 px-5 py-4 text-sm text-parchment-200">{DISCLAIMER}</p>

      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Save or print this page
        </Button>
        <Link href="/prep" className={linkButtonClasses("primary", "md")}><RotateCcw className="h-4 w-4" aria-hidden /> Practise again</Link>
        <Button variant="secondary" onClick={() => { session.clear(); }}>Clear my session now</Button>
      </div>
    </div>
  );
}
