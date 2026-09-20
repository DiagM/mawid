import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Jeux de données des tests de bout en bout.
 *
 * Volontairement explicites plutôt que générés : un test qui échoue doit se
 * lire sans avoir à dérouler une fabrique. Les horaires couvrent les 7 jours
 * pour que les scénarios ne dépendent pas du jour où la suite tourne.
 */

export const ALWAYS_OPEN = {
  monday: { open: '09:00', close: '18:00' },
  tuesday: { open: '09:00', close: '18:00' },
  wednesday: { open: '09:00', close: '18:00' },
  thursday: { open: '09:00', close: '18:00' },
  friday: { open: '09:00', close: '18:00' },
  saturday: { open: '09:00', close: '18:00' },
  sunday: { open: '09:00', close: '18:00' },
};

export interface SalonFixture {
  userId: string;
  salonId: string;
  slug: string;
  prestationId: string;
  /** Mot de passe en clair, pour se connecter dans le test. */
  password: string;
  phone: string;
}

export async function createSalon(
  prisma: PrismaService,
  options: {
    slug: string;
    phone: string;
    name?: string;
    city?: string;
    plan?: 'FREE' | 'PRO' | 'PRO_PLUS';
    prestationName?: string;
    durationMinutes?: number;
    priceCents?: number;
  },
): Promise<SalonFixture> {
  const password = 'motdepasse2026';
  // 4 tours au lieu de 12 : ces hachages ne protègent rien, et 12 tours
  // multipliés par chaque fixture rendraient la suite inutilement lente.
  const passwordHash = await bcrypt.hash(password, 4);

  const user = await prisma.user.create({
    data: {
      phone: options.phone,
      fullName: `Gérant ${options.slug}`,
      passwordHash,
      role: 'MANAGER',
    },
  });

  const salon = await prisma.salon.create({
    data: {
      slug: options.slug,
      name: options.name ?? `Salon ${options.slug}`,
      addressLine: '1 rue de Test',
      district: 'Centre',
      city: options.city ?? 'Alger',
      contactPhone: '+213555000000',
      openingHours: ALWAYS_OPEN,
      photos: [],
      isActive: true,
      plan: options.plan ?? 'PRO',
      ownerId: user.id,
    },
  });

  const prestation = await prisma.prestation.create({
    data: {
      salonId: salon.id,
      name: options.prestationName ?? 'Coupe',
      durationMinutes: options.durationMinutes ?? 30,
      priceCents: options.priceCents ?? 80000,
    },
  });

  return {
    userId: user.id,
    salonId: salon.id,
    slug: salon.slug,
    prestationId: prestation.id,
    password,
    phone: options.phone,
  };
}

/**
 * Date locale d'un jour à venir, au format `YYYY-MM-DD`.
 *
 * Toujours dans le futur et dans l'horizon de réservation : un scénario qui
 * viserait « aujourd'hui » échouerait selon l'heure à laquelle la suite
 * tourne, à cause du délai minimum avant rendez-vous.
 */
export function futureLocalDate(daysAhead = 3): string {
  const instant = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
