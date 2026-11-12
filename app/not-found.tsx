import Link from "next/link";
import { linkButtonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-brass-400">404</p>
      <h1 className="mt-2 font-serif text-3xl">This room doesn&apos;t exist.</h1>
      <Link href="/" className={linkButtonClasses("primary", "md", "mt-6")}>Back to the start</Link>
    </div>
  );
}
