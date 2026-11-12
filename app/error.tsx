"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="font-serif text-3xl">Something went wrong.</h1>
      <p className="mt-3 text-parchment-200">
        Nothing you entered was saved. Please try again. If it keeps happening, go back to the start.
      </p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
