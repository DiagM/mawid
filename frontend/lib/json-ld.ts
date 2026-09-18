import type { PublicSalon } from './api';

/** Correspondance des clés de jour vers la notation schema.org. */
const SCHEMA_DAYS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Données structurées `HealthAndBeautyBusiness` d'une fiche salon.
 *
 * C'est ce qui permet à Google d'afficher adresse, horaires et fourchette de
 * prix directement dans ses résultats — un levier d'acquisition gratuit, et
 * le seul dont dispose un salon qui n'a pas de site web.
 *
 * Le numéro public est inclus à dessein : c'est `contactPhone`, celui que le
 * salon affiche déjà en vitrine, jamais le numéro de connexion du gérant.
 */
export function salonJsonLd(salon: PublicSalon, url: string) {
  const openingHours = Object.entries(salon.openingHours ?? {})
    .filter(([, hours]) => hours !== null)
    .map(([day, hours]) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAYS[day] ?? day,
      opens: hours?.open,
      closes: hours?.close,
    }));

  const prices = salon.prestations.map((p) => p.priceCents);

  return {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: salon.name,
    url,
    ...(salon.description && { description: salon.description }),
    telephone: salon.contactPhone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: salon.addressLine,
      addressLocality: salon.district,
      addressRegion: salon.city,
      addressCountry: 'DZ',
    },
    ...(salon.latitude !== null &&
      salon.longitude !== null && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: salon.latitude,
          longitude: salon.longitude,
        },
      }),
    ...(openingHours.length > 0 && {
      openingHoursSpecification: openingHours,
    }),
    ...(prices.length > 0 && {
      priceRange: `${Math.round(Math.min(...prices) / 100)}–${Math.round(Math.max(...prices) / 100)} DZD`,
    }),
    currenciesAccepted: 'DZD',
  };
}

/**
 * Sérialisation sûre pour une balise `<script type="application/ld+json">`.
 *
 * `JSON.stringify` seul ne neutralise pas les chaînes malveillantes : un
 * `</script>` dans un nom de salon ou une description saisie par un gérant
 * refermerait la balise et permettrait une injection. On échappe donc `<`.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
