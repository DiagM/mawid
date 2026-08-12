export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold tracking-wide text-sand uppercase">
        Mawid
      </p>
      <h1 className="mt-3 max-w-sm text-3xl font-bold text-navy">
        Ton rendez-vous beauté, en 60 secondes
      </h1>
      <p className="mt-4 max-w-sm text-base text-navy/70">
        Mawid n&apos;a pas de page d&apos;accueil à proprement parler : chaque
        salon a son propre lien de réservation (partagé sur son Instagram ou
        WhatsApp). Si on t&apos;a envoyé ici, demande à ton salon le lien de sa
        fiche Mawid.
      </p>
    </main>
  );
}
