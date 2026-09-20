/**
 * ============================================
 * Mawid — Changement d'offre d'un salon
 * ============================================
 * Il n'existe aucune passerelle de paiement gratuite (docs/MVP_SCOPE.md §2.1).
 * L'encaissement se fait donc hors ligne — virement ou espèces — et le plan
 * est positionné à la main ici. C'est assumé : à l'échelle de quelques salons
 * payants, une commande vaut mieux qu'une intégration bancaire.
 *
 * Usage :
 *   # Voir l'offre et la consommation de chaque salon
 *   docker exec -it mawid-backend npm run set-plan -- --list
 *
 *   # Passer un salon au plan Pro
 *   docker exec -it mawid-backend npm run set-plan -- --slug karim-barber --plan PRO
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PLANS = ['FREE', 'PRO', 'PRO_PLUS'] as const;
type Plan = (typeof PLANS)[number];

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

/** Bornes du mois calendaire local en cours (Alger, UTC+1). */
function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-');

  const year = Number(parts[0]);
  const month = Number(parts[1]);

  // Minuit local = 23h UTC la veille (Alger est à UTC+1 toute l'année).
  const start = new Date(Date.UTC(year, month - 1, 1, -1, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, -1, 0, 0));

  return { start, end };
}

async function list() {
  const { start, end } = currentMonthRange();

  const salons = await prisma.salon.findMany({
    orderBy: [{ plan: 'desc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      plan: true,
      isActive: true,
      _count: {
        select: {
          reservations: {
            where: {
              status: { not: 'CANCELED' },
              createdAt: { gte: start, lt: end },
            },
          },
        },
      },
    },
  });

  if (salons.length === 0) {
    console.log('\nAucun salon.\n');
    return;
  }

  console.log('\n📋 Offres et consommation du mois en cours :\n');

  for (const salon of salons) {
    const used = salon._count.reservations;
    const quota = salon.plan === 'FREE' ? ' / 30' : ' (illimité)';
    const status = salon.isActive ? '' : ' — INACTIF';

    console.log(`   ${salon.slug}${status}`);
    console.log(`      ${salon.name}`);
    console.log(`      Offre : ${salon.plan} · ${used} RDV${quota}`);

    if (salon.plan === 'FREE' && used >= 24) {
      console.log(
        `      ⚠️  Proche de la limite : les clients suivants seront refusés.`,
      );
    }
    console.log('');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list === true || Object.keys(args).length === 0) {
    await list();
    return;
  }

  const slug = typeof args.slug === 'string' ? args.slug : null;
  const plan = typeof args.plan === 'string' ? args.plan.toUpperCase() : null;

  if (!slug || !plan) {
    throw new Error('Options --slug et --plan requises (ou --list)');
  }

  if (!PLANS.includes(plan as Plan)) {
    throw new Error(`Offre invalide : "${plan}". Attendu : ${PLANS.join(', ')}`);
  }

  const salon = await prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, plan: true },
  });

  if (!salon) {
    throw new Error(`Aucun salon avec le slug "${slug}"`);
  }

  if (salon.plan === plan) {
    console.log(`\nℹ️  ${salon.name} est déjà en ${plan}.\n`);
    return;
  }

  await prisma.salon.update({
    where: { id: salon.id },
    data: { plan: plan as Plan },
  });

  console.log(`\n✅ ${salon.name} : ${salon.plan} → ${plan}`);
  console.log(
    plan === 'FREE'
      ? '   Limité à 30 réservations en ligne par mois.\n'
      : '   Réservations en ligne illimitées.\n',
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
