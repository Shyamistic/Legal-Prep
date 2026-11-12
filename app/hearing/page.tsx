"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Gavel, Keyboard, Loader2, Mic, Send, Square, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAX_RECORD_SEC, Recorder } from "@/lib/audio";
import { GazeTracker } from "@/lib/gaze";
import { makeMetric } from "@/lib/metrics";
import { retrieve } from "@/lib/rag";
import { OPENING } from "@/lib/scripted";
import { session, useSession, type TurnSpeaker } from "@/lib/store";
import { cn, sleep } from "@/lib/utils";
import type { AnamClient } from "@anam-ai/js-sdk";

type Phase = "ready" | "joining" | "live";
type AvatarState = "off" | "connecting" | "live" | "failed";
type Busy = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

const speakMs = (t: string) => Math.max(1500, t.split(/\s+/).length * 400 + 600);
const label: Record<TurnSpeaker, string> = { judge: "Judge", counsel: "Opposing counsel", you: "You" };

export default function Hearing() {
  const router = useRouter();
  const s = useSession();
  const [phase, setPhase] = useState<Phase>("ready");
  const [wantCamera, setWantCamera] = useState(false);
  const [avatar, setAvatar] = useState<AvatarState>("off");
  const [avatarErr, setAvatarErr] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [speaking, setSpeaking] = useState<TurnSpeaker | null>(null);
  const [notice, setNotice] = useState("");
  const [micOk, setMicOk] = useState(true);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState("");
  const [showType, setShowType] = useState(false);
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  const anamRef = useRef<AnamClient | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const camRef = useRef<MediaStream | null>(null);
  const recRef = useRef<Recorder | null>(null);
  const gazeRef = useRef<GazeTracker | null>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addTurn = useCallback((speaker: TurnSpeaker, text: string) => {
    session.update((st) => ({ turns: [...st.turns, { id: crypto.randomUUID(), speaker, text }] }));
  }, []);

  /* ---------- cleanup ---------- */
  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioRef.current?.pause();
    gazeRef.current?.stop();
    gazeRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    camRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = camRef.current = null;
    void anamRef.current?.stopStreaming().catch(() => {});
    anamRef.current = null;
  }, []);
  useEffect(() => {
    // Free the avatar session if the tab is closed or refreshed mid-hearing.
    window.addEventListener("pagehide", teardown);
    return () => {
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [s.turns.length]);

  /* ---------- avatar (render-only: receives the judge's lines, nothing else) ---------- */
  async function connectAvatar(fallbackLook = false) {
    setAvatar("connecting");
    setAvatarErr("");
    try {
      const r = await fetch(`/api/anam/session${fallbackLook ? "?fallback=1" : ""}`, { method: "POST" });
      if (!r.ok) throw new Error("token");
      const { sessionToken } = await r.json();
      const { createClient } = await import("@anam-ai/js-sdk");
      // disableInputAudio: the avatar provider never receives the participant's microphone.
      const client = createClient(sessionToken, { disableInputAudio: true });
      await Promise.race([
        client.streamToVideoElement("judge-video"),
        sleep(15000).then(() => {
          throw new Error("timeout");
        }),
      ]);
      anamRef.current = client;
      setAvatar("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!fallbackLook && !/concurrent|429|limit/i.test(msg)) return connectAvatar(true);
      console.warn("Avatar connection failed:", e);
      setAvatarErr(/concurrent|429|limit/i.test(msg) ? "Avatar session limit reached. Close other Anam tabs or wait a minute, then retry." : "Could not connect the avatar.");
      setAvatar("failed");
    }
  }

  /* ---------- speech out ---------- */
  async function playTts(speaker: "judge" | "counsel", text: string): Promise<boolean> {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speaker }),
      });
      if (!r.ok) return false;
      const url = URL.createObjectURL(await r.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("audio"));
        audio.play().catch(reject);
      });
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function speak(speaker: "judge" | "counsel", text: string) {
    setBusy("speaking");
    setSpeaking(speaker);
    try {
      if (speaker === "judge" && anamRef.current) {
        try {
          await anamRef.current.talk(text);
          await sleep(speakMs(text));
          return;
        } catch {
          anamRef.current = null;
          setAvatar("failed");
        }
      }
      const ok = await playTts(speaker, text);
      if (!ok) await sleep(speakMs(text)); // text-only fallback: the transcript still shows the line
    } finally {
      setSpeaking(null);
      setBusy("idle");
    }
  }

  async function say(speaker: "judge" | "counsel", text: string) {
    addTurn(speaker, text);
    await speak(speaker, text);
  }

  /* ---------- entering the room ---------- */
  async function enter() {
    setPhase("joining");
    setNotice("");
    const avatarP = connectAvatar();
    try {
      micRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setMicOk(false);
      setShowType(true);
      setNotice("Microphone unavailable, so you can type your answers instead.");
    }
    if (wantCamera) {
      try {
        camRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        session.set({ cameraOn: true });
      } catch {
        setNotice((n) => n || "Camera unavailable. Continuing without eye contact practice.");
      }
    }
    await avatarP;
    setPhase("live");
    if (camRef.current) void startGaze();
    await say("judge", OPENING.judge);
  }

  async function startGaze() {
    const v = selfRef.current;
    if (!v || !camRef.current) return;
    v.srcObject = camRef.current;
    await v.play().catch(() => {});
    try {
      const g = new GazeTracker(v, (looking) =>
        session.update((st) => ({
          eye: { looking: st.eye.looking + (looking ? 1 : 0), total: st.eye.total + 1 },
        })),
      );
      await g.init();
      g.start();
      gazeRef.current = g;
    } catch {
      setNotice("Eye contact estimate unavailable in this browser. Everything else still works.");
    }
  }

  /* ---------- answering ---------- */
  async function startRecording() {
    if (!micRef.current || busy !== "idle") return;
    setNotice("");
    const rec = new Recorder(micRef.current);
    rec.onLevel = setLevel;
    try {
      await rec.start();
    } catch {
      setNotice("Could not start recording. You can type your answer instead.");
      setShowType(true);
      return;
    }
    recRef.current = rec;
    setBusy("recording");
    setElapsed(0);
    gazeRef.current?.setActive(true);
    timerRef.current = setInterval(() => {
      const e = rec.elapsedSec();
      setElapsed(e);
      if (e >= MAX_RECORD_SEC) void stopRecording();
    }, 250);
  }

  async function stopRecording() {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    gazeRef.current?.setActive(false);
    setLevel(0);
    setBusy("transcribing");
    const result = await rec.stop();
    if (result.durationSec < 0.6) {
      setNotice("I didn't catch anything. Please try again, a little closer to the microphone.");
      setBusy("idle");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("audio", result.wav, "answer.wav");
      const tStt = performance.now();
      const r = await fetch("/api/stt", { method: "POST", body: fd });
      const sttMs = Math.round(performance.now() - tStt);
      if (!r.ok) throw new Error("stt");
      const { transcript } = await r.json();
      const text = String(transcript ?? "").trim();
      if (!text) {
        setNotice("I couldn't make out that answer. Please try again.");
        setBusy("idle");
        return;
      }
      await submitAnswer(text, result, sttMs);
    } catch {
      setNotice("Transcription is unavailable right now. You can type your answer instead.");
      setShowType(true);
      setBusy("idle");
    }
  }

  async function submitAnswer(
    text: string,
    rec?: { durationSec: number; pauses: number; longestPauseSec: number },
    sttMs?: number,
  ) {
    addTurn("you", text);
    session.update((st) => ({ answers: [...st.answers, makeMetric(text, rec)] }));
    setBusy("thinking");
    const st = session.get();
    const n = st.answers.length;
    const next: "judge" | "counsel" = st.includeCounsel && n % 2 === 0 ? "counsel" : "judge";
    let line = "";
    const lastQ = [...st.turns].reverse().find((x) => x.speaker !== "you")?.text ?? "";
    // Ephemeral RAG: rank the statement locally and send only the best passages.
    const passages = st.statementText
      ? retrieve(st.statementText, `${text} ${lastQ} ${st.caseSummary}`).chunks
      : [];
    const t0 = performance.now();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker: next,
          caseSummary: st.caseSummary,
          passages,
          hearingType: st.hearingType,
          style: st.style,
          turnIndex: n,
          history: st.turns.slice(-40).map((t) => ({ speaker: t.speaker, text: t.text })),
        }),
      });
      if (!r.ok) throw new Error("chat");
      const data = await r.json();
      line = data.line;
      const m = data.meta ?? {};
      session.update((s2) => ({
        timings: [
          ...s2.timings,
          {
            turn: n,
            sttMs,
            chatMs: Math.round(performance.now() - t0),
            llmMs: m.llmMs,
            source: data.source,
            provider: m.provider,
            promptTokensEst: m.promptTokensEst,
            passages: m.passages,
            summarised: m.summarised,
          },
        ],
      }));
    } catch {
      line = "Thank you. Could you continue, in your own words?";
    }
    await say(next, line);
  }

  async function sendTyped() {
    const t = typed.trim();
    if (!t || busy !== "idle") return;
    setTyped("");
    await submitAnswer(t);
  }

  function endHearing() {
    session.set({ ended: true });
    teardown();
    router.push("/feedback");
  }

  const canAnswer = phase === "live" && busy === "idle";

  /* ---------- UI ---------- */
  const overlay =
    phase !== "live" ? (
      <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-ink-950/90 px-5 py-10 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Enter the courtroom">
      <div className="mx-auto w-full max-w-xl">
        <Card className="p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brass-400/15 text-brass-400">
            <Gavel className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-serif text-3xl">Ready when you are.</h1>
          <p className="mt-3 leading-relaxed text-parchment-200">
            You&apos;ll speak your answers aloud. Take your time. There is no pass or fail, and no one is
            watching.
          </p>
          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-start gap-2 text-parchment-200">
              <Mic className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" aria-hidden />
              Microphone: needed to practise speaking. You can type instead if you prefer.
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-parchment-200">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#d0a85c]"
                checked={wantCamera}
                onChange={(e) => setWantCamera(e.target.checked)}
              />
              <span>
                <span className="font-medium text-parchment-50">Turn on my camera (optional)</span>
                <span className="block text-parchment-400">
                  Only if you feel ready. It practises steady eye contact and is analysed on your device only.
                </span>
              </span>
            </label>
          </div>
          <Button size="lg" className="mt-7 w-full" onClick={enter} disabled={phase === "joining"}>
            {phase === "joining" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Entering the courtroom…
              </>
            ) : (
              "Enter the courtroom"
            )}
          </Button>
          {notice && <p role="status" className="mt-4 text-sm text-parchment-200">{notice}</p>}
        </Card>
      </div>
      </div>
    ) : null;

  const judgeLive = avatar === "live";
  const statusText: Record<Busy, string> = {
    idle: "Your turn. Answer when you're ready.",
    recording: "Listening… finish when you're done.",
    transcribing: "Transcribing your answer…",
    thinking: "The court is considering…",
    speaking: speaking === "counsel" ? "Opposing counsel is speaking…" : "The judge is speaking…",
  };

  return (
    <>
    {overlay}
    <div className="grid gap-5 py-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-4">
        <Card className="relative overflow-hidden border-brass-500/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]">
          <div className="relative aspect-video bg-ink-900">
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(11,16,24,0.6)_100%)]"
              aria-hidden
            />
            <div className="absolute bottom-3 left-3 z-20 rounded-md border border-brass-400/60 bg-gradient-to-b from-[#3b2a17] to-[#241709] px-4 py-1.5 shadow-lg">
              <p className="font-serif text-[10px] uppercase tracking-[0.22em] text-brass-300">The Court</p>
              <p className="font-serif text-sm text-parchment-50">District Judge (simulated)</p>
            </div>
            <video
              id="judge-video"
              autoPlay
              playsInline
              className={cn("h-full w-full object-cover", !judgeLive && "invisible")}
              aria-label="Digital judge"
            />
            {!judgeLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-parchment-200">
                <div
                  className={cn(
                    "flex h-24 w-24 items-center justify-center rounded-full bg-ink-700",
                    speaking === "judge" && "animate-pulseRing",
                  )}
                >
                  <Gavel className="h-10 w-10 text-brass-400" aria-hidden />
                </div>
                <p className="text-sm">
                  {avatar === "connecting" ? "Connecting the avatar..." : "Digital Judge - voice only"}
                </p>
                {avatar === "failed" && (
                  <div className="flex flex-col items-center gap-2 px-6 text-center">
                    <p className="text-xs text-brass-300">{avatarErr}</p>
                    <Button size="sm" variant="secondary" onClick={() => void connectAvatar()} disabled={busy === "speaking"}>
                      Retry avatar
                    </Button>
                  </div>
                )}
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-ink-950/70 px-3 py-1 text-xs backdrop-blur">
              Digital Judge{judgeLive ? " · live avatar" : ""}
            </span>
            {s.cameraOn && (
              <video
                ref={selfRef}
                muted
                playsInline
                className="absolute bottom-3 right-3 h-24 w-36 -scale-x-100 rounded-lg border border-ink-500 object-cover shadow-lg"
                aria-label="Your camera preview (stays on your device)"
              />
            )}
          </div>
          <div className="flex items-center justify-between border-t border-brass-500/40 bg-gradient-to-b from-[#3b2a17] via-[#2e2012] to-[#1f1509] px-5 py-2.5 text-xs text-brass-300">
            <span className="font-serif uppercase tracking-[0.22em]">Court Room 1</span>
            <span className="flex items-center gap-1.5 font-serif">
              <Gavel className="h-3.5 w-3.5" aria-hidden /> Civil hearing - practice session
            </span>
          </div>
        </Card>

        {s.includeCounsel && (
          <Card className="flex items-center gap-4 px-5 py-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full bg-ink-700",
                speaking === "counsel" && "animate-pulseRing",
              )}
            >
              <Users className="h-5 w-5 text-sage-400" aria-hidden />
            </div>
            <div className="text-sm">
              <p className="font-medium">Opposing counsel</p>
              <p className="text-parchment-400">Asks a few polite follow-up questions.</p>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <p role="status" aria-live="polite" className="text-sm text-parchment-200">{statusText[busy]}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {micOk && (
              busy === "recording" ? (
                <Button size="lg" variant="danger" onClick={stopRecording}>
                  <Square className="h-4 w-4" aria-hidden /> Finish answer · {Math.floor(elapsed)}s
                </Button>
              ) : (
                <Button size="lg" onClick={startRecording} disabled={!canAnswer}>
                  {busy === "transcribing" || busy === "thinking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden />
                  )}
                  Start answering
                </Button>
              )
            )}
            {busy === "recording" && (
              <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                <div className="h-full bg-brass-400 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
            )}
            <Button variant="ghost" onClick={() => setShowType((v) => !v)}>
              <Keyboard className="h-4 w-4" aria-hidden /> Type instead
            </Button>
            <Button variant="secondary" className="ml-auto" onClick={endHearing}>End hearing</Button>
          </div>
          {showType && (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendTyped();
              }}
            >
              <label htmlFor="typed" className="sr-only">Type your answer</label>
              <input
                id="typed"
                value={typed}
                maxLength={1500}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type your answer…"
                className="h-11 flex-1 rounded-lg border border-ink-500 bg-ink-900 px-4 text-sm"
              />
              <Button type="submit" variant="secondary" disabled={!canAnswer || !typed.trim()}>
                <Send className="h-4 w-4" aria-hidden /> Send
              </Button>
            </form>
          )}
          {notice && <p role="status" className="mt-3 text-sm text-brass-300">{notice}</p>}
          <p className="mt-4 text-xs text-parchment-400">
            {s.cameraOn ? (
              <Camera className="mr-1 inline h-3 w-3" aria-hidden />
            ) : (
              <CameraOff className="mr-1 inline h-3 w-3" aria-hidden />
            )}
            {s.cameraOn ? "Camera on, analysed on your device only." : "Camera off."} Practice only. Not legal advice.
          </p>        </Card>

        {debug && (
          <Card className="p-4 text-xs text-parchment-200">
            <p className="mb-2 font-medium text-parchment-50">Performance (content-free, ?debug=1)</p>
            {s.timings.length === 0 ? (
              <p className="text-parchment-400">No turns yet.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="text-parchment-400">
                  <tr><th>Turn</th><th>STT</th><th>Chat</th><th>LLM</th><th>Src</th><th>~Tokens</th><th>RAG</th></tr>
                </thead>
                <tbody>
                  {s.timings.slice(-6).map((x) => (
                    <tr key={x.turn}>
                      <td>{x.turn}</td>
                      <td>{x.sttMs ?? "-"}ms</td>
                      <td>{x.chatMs}ms</td>
                      <td>{x.llmMs ?? "-"}ms</td>
                      <td>{x.source}</td>
                      <td>{x.promptTokensEst ?? "-"}</td>
                      <td>{x.passages ?? 0}{x.summarised ? "+sum" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      <Card className="flex h-[70vh] min-h-[420px] flex-col lg:h-auto">
        <h2 className="border-b border-ink-700 px-5 py-4 font-serif text-lg">Transcript</h2>
        <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4" role="log" aria-live="polite">
          {s.turns.length === 0 && <p className="text-sm text-parchment-400">The hearing is about to begin.</p>}
          {s.turns.map((t) => (
            <div key={t.id} className={cn("animate-fadeUp", t.speaker === "you" && "pl-8")}>
              <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-parchment-400">
                {t.speaker === "you" ? <User className="h-3 w-3" aria-hidden /> : <Gavel className="h-3 w-3" aria-hidden />}
                {label[t.speaker]}
              </p>
              <p
                className={cn(
                  "rounded-xl px-4 py-3 text-sm leading-relaxed",
                  t.speaker === "you" ? "bg-brass-400/10 text-parchment-50" : "bg-ink-700/70 text-parchment-100",
                )}
              >
                {t.text}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
    </>
  );
}

