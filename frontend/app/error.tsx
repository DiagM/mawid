"use client";

import { Button } from "@/components/Button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold tracking-wide text-sand uppercase">
        Mawid
      </p>
      <h1 className="mt-3 max-w-sm text-2xl font-bold text-navy">
        Un petit souci technique
      </h1>
      <p className="mt-4 max-w-sm text-navy/70">
        Quelque chose s&apos;est mal passé de notre côté. Réessaie dans un
        instant.
      </p>
      <div className="mt-6 w-full max-w-xs">
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </main>
  );
}
