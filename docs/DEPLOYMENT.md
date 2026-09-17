# Déploiement et exploitation — Mawid

## 1. État actuel : dev uniquement

Le projet n'a **aucune décision d'hébergement de production arrêtée** à ce
jour. Tout ce qui existe est pensé pour le développement local via Docker
Compose. Ne pas supposer Vercel, Supabase ou tout autre hébergeur tant que ce
n'est pas explicitement décidé et documenté ici.

## 2. Environnement de développement (existant)

```bash
cp .env.example .env
docker compose up -d
```

- `postgres` : PostgreSQL 16, port hôte `5433` (pour ne pas entrer en
  conflit avec un Postgres local sur `5432`).
- `backend` : NestJS, port `3001`, préfixe `/api`, hot-reload via volume monté
  (`npm run start:dev`).
- `frontend` : Next.js, port `3000`, hot-reload via volume monté.

Point d'attention actuel : les variables Postgres dans `.env.example`
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`) ne sont
**pas réellement branchées** dans `docker-compose.yml` — le service `postgres`
et la `DATABASE_URL` du service `backend` ont les valeurs codées en dur
(`mawid` / `mawid_dev_password`). Ce n'est pas un problème de sécurité en dev
local, mais c'est une incohérence documentaire à corriger un jour (soit
brancher `docker-compose.yml` sur les variables du `.env`, soit simplifier
`.env.example` pour ne documenter que ce qui est réellement utilisé).

## 3. CI actuelle (`.github/workflows/ci.yml`)

- Deux jobs en parallèle : `backend` et `frontend`.
- Chacun : install → (Prisma generate pour le backend) → lint → build →
  build de l'image Docker (sans push).
- **`npm run test` n'est pas exécuté en CI** malgré la présence d'un script
  `test` dans `backend/package.json` — à ajouter dès que des tests existent
  et sont fiables, plutôt que de laisser cette lacune s'installer durablement.
- Pas de déploiement automatique configuré (pas de job `push`/`deploy`).

## 4. Ce qu'il faut décider avant une mise en production

Ces questions doivent être tranchées explicitement avec l'utilisateur — ne
pas les résoudre unilatéralement dans le code :

1. **Hébergement** : VPS unique avec Docker Compose (le plus proche de la
   config actuelle, simple pour un solo-founder en phase bootstrap) vs.
   plateformes managées séparées (ex. Vercel pour le frontend + un hébergeur
   Node/Postgres managé pour le backend). Le choix a un impact direct sur
   `docker-compose.yml`, les variables d'environnement, et la stratégie CORS.
2. **Nom de domaine et HTTPS** : reverse proxy (Caddy/Nginx/Traefik) avec
   certificat Let's Encrypt si VPS, ou géré nativement si plateforme managée.
3. **Stratégie de sauvegarde Postgres** : `pg_dump` planifié a minima,
   testé une fois pour vérifier qu'une restauration fonctionne réellement.
4. **Monitoring** : rien n'est branché à ce jour (pas de Sentry ni
   équivalent) — à ajouter avant que de vrais salons/clients utilisent le
   produit, pour ne pas découvrir les bugs par leurs retours.

## 5. Recommandations générales, valables quel que soit le choix d'hébergement

- Générer un `JWT_SECRET` de production long et aléatoire, distinct de la
  valeur de dev codée dans `docker-compose.yml`.
- Ne jamais exposer le port Postgres (`5433` en dev) publiquement en
  production — la base ne doit être joignable que depuis le backend.
- Restreindre CORS au(x) domaine(s) réel(s) du frontend en production (voir
  `docs/SECURITY.md` §7) — actuellement codé en dur sur `localhost:3000`.
- Appliquer les migrations Prisma via `prisma migrate deploy` (pas
  `migrate dev`) en production — `migrate dev` peut générer des migrations
  interactives ou réinitialiser des données, ce qui est dangereux hors dev.
- Construire les images Docker de production à partir des mêmes `Dockerfile`
  que la CI valide déjà, plutôt que d'improviser une config différente au
  moment du déploiement.

## 6. Rollback

- Conserver au minimum la capacité de revenir à l'image Docker précédente de
  chaque service (tag de version explicite plutôt que `latest`).
- Toute migration Prisma destructive (suppression de colonne/table) doit être
  précédée d'un `pg_dump` explicite avant exécution en production.
