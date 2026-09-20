# Tests de bout en bout

Ces tests montent l'**application NestJS complète** et l'interrogent par HTTP,
contre un **vrai PostgreSQL**. Ils ne remplacent pas les tests unitaires de
`src/` : ils couvrent ce que ceux-ci ne peuvent pas atteindre.

## Pourquoi une vraie base

Trois garanties du produit ne vivent pas dans le code TypeScript :

| Garantie | Où elle vit | Fichier |
|---|---|---|
| Pas de double réservation | Contrainte d'exclusion `reservations_no_overlap` | `concurrency.e2e-spec.ts` |
| Recherche insensible aux accents | Extension `unaccent` | `public.e2e-spec.ts` |
| Étanchéité entre salons | Code des services (**aucune RLS**) | `isolation.e2e-spec.ts` |

Un test unitaire avec un double de Prisma passerait au vert même si la
contrainte d'exclusion avait disparu de la base. C'est exactement le scénario
que ces tests existent pour attraper.

## Lancer la suite

La base de test est **séparée** de la base de développement : la suite vide
les tables entre chaque scénario, la pointer sur `mawid` effacerait les salons
de démonstration. Un garde-fou refuse toute base dont le nom ne finit pas par
`_test`.

Première fois seulement :

```bash
docker compose up -d postgres
docker compose exec postgres psql -U mawid -d postgres \
  -c "CREATE DATABASE mawid_test OWNER mawid;"
docker compose exec \
  -e DATABASE_URL='postgresql://mawid:mawid_dev_password@postgres:5432/mawid_test?schema=public' \
  backend npx prisma migrate deploy
```

Ensuite, à chaque fois :

```bash
docker compose exec backend npm run test:e2e
```

Après toute nouvelle migration, réappliquer `prisma migrate deploy` sur
`mawid_test` (deuxième commande ci-dessus) — sinon la suite tourne sur un
schéma périmé.

Pour ne lancer qu'un fichier :

```bash
docker compose exec backend npx jest --config ./test/jest-e2e.json \
  --testPathPatterns isolation
```

## Organisation

| Fichier | Ce qu'il verrouille |
|---|---|
| `public.e2e-spec.ts` | Recherche, fiche salon, sitemap — la seule surface indexée par Google |
| `booking.e2e-spec.ts` | Parcours client complet : créneaux → réservation → annulation |
| `concurrency.e2e-spec.ts` | Contrainte anti-double-réservation, y compris sous requêtes simultanées |
| `isolation.e2e-spec.ts` | Un gérant ne voit ni ne modifie les données d'un autre salon |
| `auth.e2e-spec.ts` | Connexion, inscription self-service, changement de mot de passe |
| `throttling.e2e-spec.ts` | Limitation de débit sur la connexion (anti-bruteforce) |
| `reviews.e2e-spec.ts` | Anti-abus des avis : venue réelle, un passage un avis, pas de censure |
| `quota.e2e-spec.ts` | Quota mensuel par offre et plafonds par numéro |

`helpers/` contient la construction de l'application, le nettoyage de la base
et les jeux de données. `setup-e2e.ts` règle l'environnement avant le
chargement des modules.

## Deux pièges à connaître

**Le rate limiting est relevé pour toute la suite.** Toutes les requêtes
partent de la même IP et le compteur vit en mémoire pour la durée du fichier :
avec les valeurs de production, la 6e connexion renverrait 429. Seul
`throttling.e2e-spec.ts` rabaisse la limite, pour lui-même, et remet la
variable d'environnement en place ensuite.

**Un seul worker** (`maxWorkers: 1`). Tous les fichiers partagent la même base
et la vident entre les scénarios ; en parallèle, l'un tronquerait les données
qu'un autre vient d'insérer.
