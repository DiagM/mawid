/**
 * ============================================
 * Amorçage des tests de bout en bout
 * ============================================
 * Exécuté par Jest AVANT le chargement des fichiers de test, donc avant que
 * `AppModule` ne lise l'environnement. C'est indispensable : les profils de
 * rate limiting sont des constantes évaluées à l'import du module, les fixer
 * après coup n'aurait aucun effet.
 *
 * Deux réglages de `jest-e2e.json` méritent une explication, que le format
 * JSON ne permet pas de porter :
 * - `maxWorkers: 1` — tous les fichiers partagent la MÊME base et la vident
 *   entre chaque scénario. En parallèle, un fichier tronquerait les données
 *   qu'un autre vient d'insérer.
 * - `testTimeout: 30000` — chaque scénario ouvre de vraies connexions
 *   PostgreSQL ; les 5 s par défaut de Jest sont trop justes à froid.
 */

/**
 * Base dédiée aux tests.
 *
 * ⚠️ La suite fait des `TRUNCATE` entre chaque scénario. La pointer sur la
 * base de développement effacerait les salons de démonstration. Le garde-fou
 * ci-dessous est volontairement strict : mieux vaut un test qui refuse de
 * démarrer qu'une base vidée par accident.
 */
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://mawid:mawid_dev_password@postgres:5432/mawid_test?schema=public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

assertLooksLikeTestDatabase(databaseUrl);
process.env.DATABASE_URL = databaseUrl;

function assertLooksLikeTestDatabase(url: string): void {
  let databaseName: string;

  try {
    // Le nom de base est le chemin de l'URL, sans le "/" initial.
    databaseName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`TEST_DATABASE_URL n'est pas une URL valide : "${url}"`);
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Les tests E2E vident la base entre chaque scénario. Ils refusent donc ` +
        `de tourner sur "${databaseName}", dont le nom ne finit pas par ` +
        `"_test". Créez-la puis appliquez les migrations :\n` +
        `  docker compose exec postgres psql -U mawid -d postgres -c "CREATE DATABASE mawid_test OWNER mawid;"\n` +
        `  docker compose exec -e DATABASE_URL=<url> backend npx prisma migrate deploy`,
    );
  }
}

// Secret de test : n'a aucune valeur hors de cette suite, et n'est jamais lu
// en production, où `JWT_SECRET` vient de l'environnement de déploiement.
process.env.JWT_SECRET ??= 'e2e-test-secret-not-used-anywhere-else';
process.env.JWT_EXPIRES_IN ??= '1h';

/**
 * Rate limiting neutralisé par défaut.
 *
 * Toutes les requêtes de la suite partent de la même IP (127.0.0.1) et le
 * compteur du throttler vit en mémoire pour toute la durée du fichier. Avec
 * les valeurs de production, la 6e connexion d'un fichier renverrait 429 et
 * les tests échoueraient pour une raison sans rapport avec ce qu'ils
 * vérifient.
 *
 * Le rate limiting lui-même n'est donc pas désactivé « parce qu'on ne sait
 * pas le tester » : `throttling.e2e-spec.ts` rabaisse les limites pour lui
 * seul et vérifie qu'elles s'appliquent réellement.
 */
process.env.THROTTLE_DEFAULT_LIMIT ??= '100000';
process.env.THROTTLE_AUTH_LIMIT ??= '100000';
process.env.THROTTLE_BOOKING_LIMIT ??= '100000';
process.env.THROTTLE_TOKEN_LIMIT ??= '100000';
