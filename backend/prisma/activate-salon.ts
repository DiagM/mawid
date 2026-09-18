/**
 * ============================================
 * Mawid — Validation d'un salon inscrit
 * ============================================
 * Un salon créé par inscription self-service arrive `isActive = false` : il
 * n'apparaît dans aucune recherche et sa fiche publique renvoie un 404. C'est
 * ce qui rend l'inscription ouverte acceptable sans vérification d'identité.
 *
 * Ce script est l'autre moitié du dispositif : la validation manuelle.
 *
 * Usage :
 *   # Lister les salons en attente
 *   docker exec -it mawid-backend npx tsx prisma/activate-salon.ts --list
 *
 *   # Activer (ou désactiver) un salon
 *   docker exec -it mawid-backend npx tsx prisma/activate-salon.ts --slug mon-salon
 *   docker exec -it mawid-backend npx tsx prisma/activate-salon.ts --slug mon-salon --off
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

async function listPending() {
  const salons = await prisma.salon.findMany({
    where: { isActive: false },
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      name: true,
      district: true,
      contactPhone: true,
      createdAt: true,
      owner: { select: { fullName: true, phone: true } },
      _count: { select: { prestations: true } },
    },
  });

  if (salons.length === 0) {
    console.log('\n✅ Aucun salon en attente de validation.\n');
    return;
  }

  console.log(`\n⏳ ${salons.length} salon(s) en attente :\n`);

  for (const salon of salons) {
    const date = salon.createdAt.toISOString().slice(0, 10);
    console.log(`   ${salon.slug}`);
    console.log(`      ${salon.name} — ${salon.district}`);
    console.log(
      `      Gérant : ${salon.owner.fullName ?? '—'} (${salon.owner.phone})`,
    );
    console.log(`      Contact public : ${salon.contactPhone}`);
    console.log(
      `      ${salon._count.prestations} prestation(s) · inscrit le ${date}`,
    );
    console.log('');
  }

  console.log('   Pour activer : --slug <slug>\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list === true || Object.keys(args).length === 0) {
    await listPending();
    return;
  }

  const slug = typeof args.slug === 'string' ? args.slug : null;
  if (!slug) {
    throw new Error('Option --slug manquante (ou utilisez --list)');
  }

  const isActive = args.off !== true;

  const salon = await prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, isActive: true },
  });

  if (!salon) {
    throw new Error(`Aucun salon avec le slug "${slug}"`);
  }

  if (salon.isActive === isActive) {
    console.log(
      `\nℹ️  ${salon.name} est déjà ${isActive ? 'actif' : 'inactif'}.\n`,
    );
    return;
  }

  await prisma.salon.update({ where: { id: salon.id }, data: { isActive } });

  console.log(
    `\n✅ ${salon.name} est maintenant ${isActive ? 'ACTIF' : 'INACTIF'}.`,
  );
  console.log(
    isActive
      ? `   Sa fiche est publique : /${slug}\n`
      : `   Sa fiche ne répond plus et il sort des recherches.\n`,
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
