import Link from "next/link";

export default function SalonNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold tracking-wide text-sand uppercase">
        Mawid
      </p>
      <h1 className="mt-3 max-w-sm text-2xl font-bold text-navy">
        Ce salon est introuvable
      </h1>
      <p className="mt-4 max-w-sm text-navy/70">
        Le lien utilisé est peut-être incorrect, ou ce salon n&apos;est plus
        actif pour le moment. Vérifie le lien auprès du salon.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-navy underline underline-offset-4"
      >
        Retour à l&apos;accueil Mawid
      </Link>
    </main>
  );
}
