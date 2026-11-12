import { Card } from "@/components/ui/card";

const rows: [string, string, string][] = [
  ["Your papers and case description", "Held in your browser's memory only. Sent to the AI model only to write the next question.", "Cleared when you finish, remove them, or close the page."],
  ["Your voice", "Sent as a short clip to speech-to-text (Gnani Prisma) to produce a transcript.", "Not stored by this app."],
  ["Camera", "Analysed on your device only (MediaPipe). Images never leave your browser.", "Nothing kept except a running eye-contact percentage."],
  ["Avatar (Anam)", "Receives only the lines the judge speaks. Never your voice, camera, papers or transcript.", "Session ends with the hearing."],
  ["Counsel voice (Gnani Timbre)", "Receives only the individual line to be spoken.", "Not stored by this app."],
  ["Feedback scores", "Numbers only, computed in your browser.", "Gone when you close the page."],
];

export const metadata = { title: "Privacy | LegalPrep" };

export default function Privacy() {
  return (
    <div className="py-8">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-400">Privacy</p>
      <h1 className="mt-2 font-serif text-4xl">What happens to your information.</h1>
      <p className="mt-3 max-w-2xl text-parchment-200">
        Legal papers are sensitive, so this demo is designed to keep as little as possible. There are no
        accounts, no database, no analytics and no advertising trackers.
      </p>
      <Card className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">How each type of information is handled</caption>
          <thead className="text-parchment-400">
            <tr>
              <th scope="col" className="px-6 py-4 font-medium">Information</th>
              <th scope="col" className="px-6 py-4 font-medium">Where it goes</th>
              <th scope="col" className="px-6 py-4 font-medium">How long</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([a, b, c]) => (
              <tr key={a} className="border-t border-ink-700 align-top">
                <th scope="row" className="px-6 py-4 font-medium text-parchment-50">{a}</th>
                <td className="px-6 py-4 text-parchment-200">{b}</td>
                <td className="px-6 py-4 text-parchment-200">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-6 max-w-2xl text-sm text-parchment-400">
        We cannot see inside third-party providers, so please upload only what your practice session needs.
        There is no biometric identification: the eye-contact feature estimates where you are looking on your
        device and creates no face template or voiceprint. Nothing here is designed to judge your honesty,
        emotions or the merits of your case.
      </p>
    </div>
  );
}
