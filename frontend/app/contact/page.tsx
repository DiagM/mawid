import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@/lib/i18n/fr';
import { Logo } from '@/components/logo';
import { siteUrl } from '@/lib/site-url';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: fr.contact.metaTitle,
  description: fr.contact.metaDescription,
  alternates: { canonical: `${siteUrl()}/contact` },
};

type PageProps = {
  searchParams: Promise<{ sujet?: string; offre?: string }>;
};

/**
 * Page contact publique.
 *
 * Ouverte sans compte, délibérément : un salon pas encore inscrit doit
 * pouvoir écrire, c'est un canal d'acquisition. C'est donc la troisième
 * surface d'écriture publique du produit — protégée comme les deux autres,
 * par un honeypot et un plafond de débit, sans captcha.
 *
 * Les paramètres `sujet` et `offre` permettent aux écrans verrouillés du
 * back-office de pointer ici avec la demande déjà formulée.
 */
export default async function ContactPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const kind =
    params.sujet === 'offre'
      ? 'UPGRADE'
      : params.sujet === 'probleme'
        ? 'ISSUE'
        : 'OTHER';

  const plan =
    params.offre === 'PRO_PLUS'
      ? 'PRO_PLUS'
      : params.offre === 'PRO'
        ? 'PRO'
        : undefined;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <Link href="/" className="mb-8 inline-block">
        <Logo size="sm" />
      </Link>

      <h1 className="mb-2 text-2xl font-semibold rule-gold">
        {fr.contact.title}
      </h1>
      <p className="mb-8 text-muted">{fr.contact.intro}</p>

      <ContactForm defaultKind={kind} defaultPlan={plan} />
    </main>
  );
}
