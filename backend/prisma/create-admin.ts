/**
 * ============================================
 * Mawid — Création du compte administrateur
 * ============================================
 * Le seul geste qui reste en ligne de commande, et il le restera : c'est
 * l'amorçage. Une route qui créerait le premier administrateur devrait être
 * ouverte à tous, ce qui reviendrait à offrir la console à quiconque la
 * trouve. Tout le reste — salons, gérants, offres, modération — passe
 * désormais par `/admin` dans le navigateur.
 *
 * Usage :
 *   docker compose exec backend npx tsx prisma/create-admin.ts \
 *     --phone +213555000000 --name "Mohamed DIAG"
 *
 * Options : --password (sinon généré et affiché une seule fois).
 *
 * Relancé sur un numéro existant, le script PROMEUT le compte en ADMIN sans
 * toucher à son mot de passe : c'est le cas courant où le fondateur a déjà un
 * compte gérant de test.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const BCRYPT_ROUNDS = 12;

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

/** Même alphabet que `src/common/password.ts` : sans caractères ambigus. */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(16))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const phone = typeof args.phone === 'string' ? args.phone.trim() : '';
  const fullName = typeof args.name === 'string' ? args.name.trim() : '';

  if (!/^\+213[5-7]\d{8}$/.test(phone)) {
    throw new Error(
      `Option --phone manquante ou invalide. Format attendu : +213XXXXXXXXX`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { phone } });

  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`ℹ️  ${phone} est déjà administrateur. Rien à faire.`);
      return;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ ${phone} est désormais ADMIN.`);
    console.log('   Son mot de passe est inchangé.');
    return;
  }

  if (!fullName) {
    throw new Error('Option --name requise pour créer un nouveau compte');
  }

  const password =
    typeof args.password === 'string' ? args.password : generatePassword();

  if (password.length < 10) {
    throw new Error('Le mot de passe doit faire au moins 10 caractères');
  }

  const user = await prisma.user.create({
    data: {
      phone,
      fullName,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'ADMIN',
      // Un mot de passe choisi par le fondateur lui-même n'a pas à être
      // remplacé : personne d'autre ne le connaît.
      mustChangePassword: typeof args.password !== 'string',
    },
  });

  console.log(`\n✅ Administrateur créé : ${user.fullName} (${user.phone})`);
  console.log('\n   ⚠️  Mot de passe affiché UNE SEULE FOIS :\n');
  console.log(`   ${password}\n`);
  console.log('   Console : http://localhost:3000/admin\n');
}

main()
  .catch((error: unknown) => {
    console.error(
      `\n❌ ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
