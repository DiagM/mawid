import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
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
