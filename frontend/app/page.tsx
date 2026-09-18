import { fr } from '@/lib/i18n/fr';

/**
 * Accueil.
 *
 * Volontairement minimal en V1 : le produit se diffuse par le lien direct
 * d'un salon (`mawid.dz/karim-barber`), partagé sur WhatsApp ou affiché en
 * vitrine. La recherche par ville et prestation est prévue au lot 4
 * (docs/MVP_SCOPE.md §5) — l'ajouter ici avant d'avoir plusieurs salons
 * afficherait une page de résultats vide.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-accent">
        {fr.app.name}
      </h1>
      <p className="mt-3 text-lg text-muted">{fr.app.tagline}</p>
      <p className="mt-8 text-sm text-muted">
        Rendez-vous sur le lien de votre salon pour réserver.
      </p>
    </main>
  );
}
