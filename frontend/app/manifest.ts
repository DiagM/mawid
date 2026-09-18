import type { MetadataRoute } from 'next';
import { fr } from '@/lib/i18n/fr';

/**
 * Manifeste PWA.
 *
 * Le business plan écarte explicitement l'application mobile native — « PWA
 * suffit » (§7.1). Ce manifeste permet au gérant d'épingler Mawid sur son
 * écran d'accueil et de retrouver son agenda comme une application, sans
 * store, sans compte développeur, sans coût.
 *
 * Pas de service worker en V1 : un cache hors ligne sur des créneaux de
 * réservation ferait afficher des disponibilités périmées, ce qui est pire
 * qu'une page qui ne charge pas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${fr.app.name} — ${fr.app.tagline}`,
    short_name: fr.app.name,
    description:
      'Réservez votre rendez-vous chez les salons de beauté et barbershops à Alger.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf9f6',
    theme_color: '#1f6f5c',
    lang: 'fr',
    dir: 'ltr',
    categories: ['lifestyle', 'business'],
  };
}
