"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const phone = `+213${phoneDigits}`;
    if (phoneDigits.length !== 9) {
      setError("Numéro invalide. Format attendu : +213 suivi de 9 chiffres.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      await login(phone, password);
      router.push("/pro/agenda");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Identifiants invalides.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Une erreur est survenue. Réessaie.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-navy">
          Ton numéro de téléphone
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-3 focus-within:border-sand">
          <span className="text-navy/50">+213</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={9}
            value={phoneDigits}
            onChange={(e) =>
              setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 9))
            }
            placeholder="5XXXXXXXX"
            className="w-full flex-1 bg-transparent text-base text-navy outline-none"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-navy"
        >
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-base text-navy outline-none focus:border-sand"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" loading={submitting}>
        Se connecter
      </Button>
    </form>
  );
}
