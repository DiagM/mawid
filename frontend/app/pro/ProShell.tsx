"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { ApiError, api } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import { BottomNav } from "./BottomNav";

type GuardState = "checking" | "authenticated" | "unauthenticated" | "error";

/**
 * Coquille de l'espace pro (hors connexion) : vérifie qu'un token valide est
 * présent (via `GET /auth/me`) avant d'afficher quoi que ce soit, puis
 * affiche la navigation persistante (agenda / salon / déconnexion).
 *
 * Vérification faite une fois au montage seulement (pas à chaque
 * navigation) : un `retryCount` permet de la redéclencher explicitement
 * depuis le bouton "Réessayer" sans dupliquer la logique.
 */
export function ProShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      if (!token) {
        setState("unauthenticated");
        return;
      }
      try {
        await api.getMe(token);
        setState("authenticated");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          setState("unauthenticated");
        } else {
          setState("error");
        }
      }
    }
    void checkAuth();
  }, [retryCount]);

  // Redirection vers la connexion dès qu'on sait qu'il n'y a pas de session
  // valide (synchronisation avec le routeur, pas une donnée dérivée).
  useEffect(() => {
    if (state === "unauthenticated") {
      router.replace("/pro/connexion");
    }
  }, [state, router]);

  function handleRetry() {
    setState("checking");
    setRetryCount((c) => c + 1);
  }

  function handleLogout() {
    logout();
    router.replace("/pro/connexion");
  }

  if (state === "checking" || state === "unauthenticated") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-8 w-8 text-navy" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <p className="text-navy/70">
          Impossible de vérifier ta connexion. Vérifie ta connexion internet
          et réessaie.
        </p>
        <div className="w-full max-w-xs">
          <Button variant="ghost" onClick={handleRetry}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col pb-16">{children}</div>
      <BottomNav onLogout={handleLogout} />
    </div>
  );
}
