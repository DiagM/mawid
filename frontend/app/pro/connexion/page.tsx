import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion — Mawid Pro",
  robots: { index: false, follow: false },
};

export default function ConnexionPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-sand uppercase">
        Mawid Pro
      </p>
      <h1 className="mt-1 text-2xl font-bold text-navy">
        Connecte-toi à ton salon
      </h1>
      <p className="mt-2 text-sm text-navy/60">
        Retrouve ton agenda du jour et gère ton salon.
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>
    </main>
  );
}
