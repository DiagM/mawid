import type { MetadataRoute } from 'next';
import { isIndexingAllowed } from '@/lib/indexing';
import { siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  // Tant que le produit est en test, on refuse tout le site plutot que
  // d'affiner : un catalogue vide indexe sous une adresse provisoire est
  // une dette qu'on traine ensuite sur le domaine definitif.
  if (!isIndexingAllowed()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/r/` porte des tokens d'annulation, `/pro/` l'espace gérant : ni
      // l'un ni l'autre ne doit être exploré. Les pages concernées portent
      // déjà `noindex`, ceci est la seconde barrière.
      disallow: ['/pro/', '/r/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
