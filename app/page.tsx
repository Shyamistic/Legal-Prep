import Link from "next/link";
import { ArrowRight, Camera, BellRing, Gavel, LineChart, Map } from "lucide-react";
import { linkButtonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WaitlistForm } from "@/components/waitlist-form";

const steps = [
  { icon: Map, title: "Walk through the courtroom.", body: "A guided tour of the room, so you know who is who and where to sit." },
  { icon: Gavel, title: "Start a session.", body: "Begin a hearing with our digital judge, and, where it helps, a participant from the other side." },
  { icon: Camera, title: "Turn on your camera, when you feel ready.", body: "Only enable your camera if you feel ready. It is just so we can help you practise holding strong, steady eye contact." },
  { icon: LineChart, title: "See feedback on your delivery.", body: "How your delivery came across, on pace, clarity and composure. Never on what you should say." },
  { icon: BellRing, title: "Receive reminders before the day.", body: "Simple reminders of what to have in mind before the hearing, so nothing important slips on the day." },
];

export default function Home() {
  return (
    <>
      <section className="grid items-center gap-10 pb-16 pt-10 md:grid-cols-[1.2fr_1fr] md:pt-16">
        <div className="animate-fadeUp">
          <p className="mb-5 text-xs uppercase tracking-[0.22em] text-brass-400">
            LegalPrep · Virtual courtroom · England &amp; Wales
          </p>
          <h1 className="font-serif text-4xl leading-[1.1] md:text-6xl">Familiarise yourself with a hearing.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-parchment-200">
            A virtual courtroom with a digital judge. Practice your delivery, get feedback on your pace, and
            build composure.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/prep" className={linkButtonClasses("primary", "lg")}>
              Enter the Prep Room <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/tour" className={linkButtonClasses("ghost", "lg")}>Take the tour first</Link>
          </div>
          <div className="mt-10">
            <p className="mb-3 text-sm text-parchment-400">Or get a note when the full courtroom is ready:</p>
            <WaitlistForm />
          </div>
        </div>

        <Card className="relative overflow-hidden p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brass-400/10 blur-2xl" aria-hidden />
          <p className="font-serif text-2xl leading-snug text-parchment-50">
            &ldquo;Familiarity makes space for composure.&rdquo;
          </p>
          <p className="mt-5 text-sm leading-relaxed text-parchment-200">
            We built it so that sharing your story will not feel so frightening, once you have a sense of what
            a hearing may feel like.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-parchment-200">
            <li>• No legal advice. Ever.</li>
            <li>• Your papers stay in your browser&apos;s memory.</li>
            <li>• Feedback on delivery, never on content.</li>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="how" className="py-10">
        <p className="text-xs uppercase tracking-[0.22em] text-brass-400">Product · See it in action</p>
        <h2 id="how" className="mt-2 font-serif text-3xl md:text-4xl">How it works.</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-5">
                <div className="mb-4 flex items-center justify-between text-brass-400">
                  <s.icon className="h-5 w-5" aria-hidden />
                  <span className="font-serif text-sm text-parchment-400">0{i + 1}</span>
                </div>
                <h3 className="font-serif text-lg leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-parchment-200">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
