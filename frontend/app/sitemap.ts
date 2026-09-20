import type { MetadataRoute } from 'next';
import { getSalonSitemap } from '@/lib/api';
import { siteUrl } from '@/lib/site-url';

/**
 * Sitemap.
 *
 * Y figurent l'accueil, la page de présentation aux salons et les fiches
 * salon. Le tunnel de réservation et les pages `/r/<token>` sont en
 * `noindex`, et le back-office n'a rien à faire dans un index public.
 *
 * Si le backend est injoignable au moment de la génération, on renvoie au
 * moins l'accueil plutôt que de faire échouer la route entière — un sitemap
 * partiel vaut mieux qu'une 500 servie à un robot d'indexation.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const home: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      // Page d'acquisition B2B : c'est par elle qu'un gérant qui cherche
      // « logiciel rendez-vous salon Alger » doit arriver.
      url: `${base}/pour-les-salons`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  try {
    const salons = await getSalonSitemap();

    return [
      ...home,
      ...salons.map((salon) => ({
        url: `${base}/${salon.slug}`,
        lastModified: new Date(salon.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return home;
  }
}
