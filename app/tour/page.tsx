"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { linkButtonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const places = [
  { id: "judge", label: "Judge", x: 50, y: 14, text: "Sits at the front, usually raised. Listens, asks questions to understand your account, and makes the decisions. You address the judge directly and politely." },
  { id: "clerk", label: "Clerk / Usher", x: 24, y: 24, text: "Helps the hearing run smoothly: calling cases, showing people where to sit, and handling paperwork. A friendly person to ask if you are unsure where to go." },
  { id: "witness", label: "Where you give evidence", x: 50, y: 46, text: "When it is your turn, you will usually speak from a set place facing the judge. Take your time, speak at a steady pace, and ask for a question to be repeated if you need to." },
  { id: "you", label: "Your seat", x: 30, y: 66, text: "Where you sit while others speak. You can usually keep notes and your papers with you. Wait for your turn rather than interrupting." },
  { id: "other", label: "The other side", x: 70, y: 66, text: "The other party or their representative sits across from you. They may ask you questions. Questions are about what happened, and you can answer calmly in your own words." },
  { id: "gallery", label: "Public gallery", x: 50, y: 88, text: "Many hearings are open, so members of the public may sit at the back. Some hearings are held privately, depending on the court." },
];

export default function Tour() {
  const [active, setActive] = useState(places[0].id);
  const current = places.find((p) => p.id === active)!;
  return (
    <div className="py-8">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-400">Step 01</p>
      <h1 className="mt-2 font-serif text-4xl">Walk through the courtroom.</h1>
      <p className="mt-3 max-w-2xl text-parchment-200">
        A guided tour of the room, so you know who is who and where to sit. Layouts vary between courts, so
        treat this as a general picture.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <Card className="p-4">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl rounded-xl border border-ink-600 bg-ink-900">
            <div className="absolute inset-x-[10%] top-[6%] h-[14%] rounded-t-3xl border border-ink-500 bg-ink-700/60" aria-hidden />
            <div className="absolute inset-x-[8%] top-[56%] h-px bg-ink-600" aria-hidden />
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                aria-pressed={active === p.id}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition",
                  active === p.id
                    ? "border-brass-400 bg-brass-400 text-ink-950 shadow-lg"
                    : "border-ink-500 bg-ink-800 text-parchment-100 hover:border-brass-400",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6" aria-live="polite">
          <h2 className="font-serif text-2xl">{current.label}</h2>
          <p className="mt-3 leading-relaxed text-parchment-200">{current.text}</p>
          <p className="mt-6 text-xs text-parchment-400">General familiarisation only. Not legal advice.</p>
        </Card>
      </div>

      <div className="mt-8">
        <Link href="/prep" className={linkButtonClasses("primary", "lg")}>
          Continue to the Prep Room <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
