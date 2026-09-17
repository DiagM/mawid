/**
 * ============================================
 * Mawid — Création d'un compte gérant + son salon
 * ============================================
 * Il n'y a volontairement PAS de route d'inscription publique en V1 : avec une
 * poignée de salons ambassadeurs, l'onboarding est un geste commercial, pas un
 * parcours produit. Cela supprime d'un coup le besoin de captcha, d'anti-spam
 * et de vérification de numéro (cf. docs/MVP_SCOPE.md §3.4).
 *
 * Usage :
 *   docker exec -it mawid-backend npx tsx prisma/create-manager.ts \
 *     --phone +213555123456 \
 *     --name "Karim Benali" \
 *     --salon "Karim Barber Shop" \
 *     --slug karim-barber \
 *     --address "12 rue des Frères Bouadou" \
 *     --district "Bab Ezzouar" \
 *     --contact +213555123457
 *
 * Options : --city (défaut Alger), --women-only, --password (sinon généré).
 *
 * Le mot de passe est généré et affiché UNE SEULE FOIS. Le compte est créé
 * avec mustChangePassword = true : le gérant devra le remplacer à sa première
 * connexion, pour qu'aucun secret ne reste connu de deux personnes.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const BCRYPT_ROUNDS = 12;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Horaires par défaut : ouvert tous les jours sauf vendredi. */
const DEFAULT_OPENING_HOURS = {
  monday: { open: '09:00', close: '19:00' },
  tuesday: { open: '09:00', close: '19:00' },
  wednesday: { open: '09:00', close: '19:00' },
  thursday: { open: '09:00', close: '19:00' },
  friday: null,
  saturday: { open: '09:00', close: '19:00' },
  sunday: { open: '09:00', close: '19:00' },
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    // Un drapeau sans valeur (--women-only) vaut true.
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

function requireString(
  args: Record<string, string | boolean>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Option --${key} manquante`);
  }
  return value.trim();
}

/** E.164 mobile algérien, même règle que les DTO de l'API. */
function assertAlgerianPhone(phone: string, label: string): void {
  if (!/^\+213[5-7]\d{8}$/.test(phone)) {
    throw new Error(
      `${label} invalide : "${phone}". Format attendu +213XXXXXXXXX.`,
    );
  }
}

/**
 * Mot de passe initial : 16 caractères issus de crypto.randomBytes.
 * Pas de Math.random ici — ce secret protège l'agenda complet d'un salon et
 * les numéros de téléphone de ses clients.
 */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const phone = requireString(args, 'phone');
  const fullName = requireString(args, 'name');
  const salonName = requireString(args, 'salon');
  const slug = requireString(args, 'slug');
  const addressLine = requireString(args, 'address');
  const district = requireString(args, 'district');
  const contactPhone = requireString(args, 'contact');

  const city = typeof args.city === 'string' ? args.city : 'Alger';
  const isWomenOnly = args['women-only'] === true;

  assertAlgerianPhone(phone, 'Numéro de connexion du gérant');
  assertAlgerianPhone(contactPhone, 'Numéro WhatsApp public du salon');

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `Slug invalide : "${slug}". Attendu en minuscules avec des tirets.`,
    );
  }

  // On échoue plutôt que d'écraser : ce script ne doit jamais réinitialiser
  // silencieusement le mot de passe d'un gérant déjà en activité.
  const existingUser = await prisma.user.findUnique({ where: { phone } });
  if (existingUser) {
    throw new Error(`Un compte existe déjà avec le numéro ${phone}`);
  }

  const existingSalon = await prisma.salon.findUnique({ where: { slug } });
  if (existingSalon) {
    throw new Error(`Un salon utilise déjà le slug "${slug}"`);
  }

  const password =
    typeof args.password === 'string' ? args.password : generatePassword();

  if (password.length < 10) {
    throw new Error('Le mot de passe initial doit faire au moins 10 caractères');
  }

  const user = await prisma.user.create({
    data: {
      phone,
      fullName,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'MANAGER',
      mustChangePassword: true,
    },
  });

  const salon = await prisma.salon.create({
    data: {
      slug,
      name: salonName,
      addressLine,
      district,
      city,
      contactPhone,
      isWomenOnly,
      openingHours: DEFAULT_OPENING_HOURS,
      photos: [],
      isActive: true,
      ownerId: user.id,
    },
  });

  console.log('\n✅ Compte gérant créé');
  console.log(`   Gérant  : ${user.fullName} (${user.phone})`);
  console.log(`   Salon   : ${salon.name} — /${salon.slug}`);
  console.log(`   Contact : ${salon.contactPhone}`);
  console.log(`   Ville   : ${salon.city}${isWomenOnly ? ' — 100 % féminin' : ''}`);
  console.log('\n🔑 Mot de passe initial (affiché une seule fois) :');
  console.log(`   ${password}`);
  console.log(
    '\n   À transmettre de vive voix ou sur un canal direct, jamais par écrit',
  );
  console.log(
    '   partagé. Le gérant devra le changer à sa première connexion.\n',
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ${message}\n`);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
