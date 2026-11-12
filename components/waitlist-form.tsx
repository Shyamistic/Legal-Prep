"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Demo only: validates the address and confirms. Nothing is sent or stored. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setDone(true);
  }

  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 text-sage-400">
        <Check className="h-4 w-4" aria-hidden /> Thank you. You&apos;re in. You will be notified when the
        courtroom is ready.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row" noValidate>
      <label htmlFor="wl-email" className="sr-only">Email address</label>
      <input
        id="wl-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "wl-error" : undefined}
        className="h-11 flex-1 rounded-lg border border-ink-500 bg-ink-900 px-4 text-sm placeholder:text-parchment-400"
      />
      <Button type="submit" variant="secondary">Notify me</Button>
      {error && (
        <p id="wl-error" role="alert" className="text-sm text-red-300 sm:basis-full">{error}</p>
      )}
    </form>
  );
}
