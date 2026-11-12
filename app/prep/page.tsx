"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEARING_TYPES, STYLES, type HearingType, type QuestionStyle } from "@/lib/context";
import { session, useSession } from "@/lib/store";

const MAX_CHARS = 40000;

export default function PrepRoom() {
  const router = useRouter();
  const s = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [ack, setAck] = useState(false);
  const [drag, setDrag] = useState(false);

  async function readFile(file: File) {
    setError("");
    if (!/\.(txt|md)$/i.test(file.name) && !file.type.startsWith("text/")) {
      setError("This demo reads plain text files (.txt or .md). For other formats, paste the text below.");
      return;
    }
    if (file.size > 400_000) {
      setError("That file is too large for the demo. Please use a shorter extract.");
      return;
    }
    const text = (await file.text()).slice(0, MAX_CHARS);
    session.set({ statementName: file.name, statementText: text });
  }

  function start() {
    if (!ack) {
      setError("Please confirm you understand this is practice only.");
      return;
    }
    session.set({ turns: [], answers: [], eye: { looking: 0, total: 0 }, ended: false });
    router.push("/hearing");
  }

  return (
    <div className="py-8">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-400">Step 02</p>
      <h1 className="mt-2 font-serif text-4xl">The Prep Room</h1>
      <p className="mt-3 max-w-2xl text-parchment-200">
        Add a little context so the questions feel relevant. Both items are optional. The judge only asks
        clarifying questions. It will never tell you what to say.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Upload witness statement</CardTitle></CardHeader>
            <CardContent>
              {s.statementName ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-500 bg-ink-900 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3 text-sm">
                    <FileText className="h-5 w-5 shrink-0 text-brass-400" aria-hidden />
                    <span className="truncate">{s.statementName}</span>
                    <span className="shrink-0 text-parchment-400">{s.statementText.length.toLocaleString()} characters</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => session.set({ statementName: "", statementText: "" })}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </Button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void readFile(f); }}
                  className={`flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition ${drag ? "border-brass-400 bg-brass-400/5" : "border-ink-500"}`}
                >
                  <Upload className="h-6 w-6 text-brass-400" aria-hidden />
                  <p className="text-sm text-parchment-200">Drag a .txt or .md file here, or</p>
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Choose a file</Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    className="sr-only"
                    aria-label="Upload witness statement"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle><label htmlFor="summary">Brief case summary</label></CardTitle></CardHeader>
            <CardContent>
              <textarea
                id="summary"
                rows={6}
                maxLength={4000}
                value={s.caseSummary}
                onChange={(e) => session.set({ caseSummary: e.target.value })}
                placeholder="In a few sentences, what is the hearing about? (Optional)"
                className="w-full resize-y rounded-xl border border-ink-500 bg-ink-900 px-4 py-3 text-sm leading-relaxed placeholder:text-parchment-400"
              />
              <p className="mt-2 text-right text-xs text-parchment-400">{s.caseSummary.length}/4000</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Hearing setup</CardTitle></CardHeader>
            <CardContent className="space-y-5 text-sm">
              <fieldset>
                <legend className="mb-2 font-medium">Type of hearing</legend>
                <div className="grid gap-2">
                  {(Object.keys(HEARING_TYPES) as HearingType[]).map((k) => (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${s.hearingType === k ? "border-brass-400 bg-brass-400/10" : "border-ink-600 hover:border-ink-500"}`}
                    >
                      <input
                        type="radio"
                        name="hearingType"
                        className="mt-1 accent-[#d0a85c]"
                        checked={s.hearingType === k}
                        onChange={() => session.set({ hearingType: k })}
                      />
                      <span>
                        <span className="font-medium">{HEARING_TYPES[k].label}</span>
                        <span className="block text-parchment-400">{HEARING_TYPES[k].blurb}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 font-medium">Question style</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(STYLES) as QuestionStyle[]).map((k) => (
                    <label
                      key={k}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-center transition ${s.style === k ? "border-brass-400 bg-brass-400/10" : "border-ink-600 hover:border-ink-500"}`}
                    >
                      <input
                        type="radio"
                        name="style"
                        className="sr-only"
                        checked={s.style === k}
                        onChange={() => session.set({ style: k })}
                      />
                      <span className="block font-medium">{STYLES[k].label}</span>
                      <span className="block text-xs text-parchment-400">{STYLES[k].blurb}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Your session</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={s.includeCounsel}
                  onChange={(e) => session.set({ includeCounsel: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[#d0a85c]"
                />
                <span>
                  <span className="font-medium">Include a participant from the other side</span>
                  <span className="block text-parchment-400">Opposing counsel asks a few polite follow-up questions.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#d0a85c]"
                />
                <span>
                  I&apos;m 18 or over and understand this is practice for my delivery only. LegalPrep is not a
                  law firm and gives no legal advice.
                </span>
              </label>
              {error && <p role="alert" className="text-red-300">{error}</p>}
              <Button size="lg" className="w-full" onClick={start}>Start Virtual Hearing</Button>
              <Button variant="ghost" className="w-full" onClick={() => { session.clear(); setAck(false); setError(""); }}>
                Clear everything
              </Button>
            </CardContent>
          </Card>

          <Card className="p-5 text-sm text-parchment-200">
            <p className="flex items-center gap-2 font-medium text-parchment-50">
              <ShieldCheck className="h-4 w-4 text-sage-400" aria-hidden /> Held in memory only
            </p>
            <p className="mt-2 leading-relaxed">
              Your papers stay in this browser tab. They are used to write questions, then cleared when you
              finish or close the page.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
