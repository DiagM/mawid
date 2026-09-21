# Déploiement et exploitation — Mawid

## 1. État actuel

Le code tourne en local via Docker Compose. Le plan de **premier déploiement
gratuit** est arrêté et décrit au §4 (Neon + Render + Netlify), mais **rien
n'est encore déployé** : aucun compte n'est créé, aucune de ces variables
n'est positionnée quelque part.

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

**Piège du port 3000 déjà occupé** : si un autre serveur Node tourne sur le
port 3000 de la machine hôte, il « gagne » sur la publication de port Docker
et c'est *lui* que `http://localhost:3000` sert — le symptôme est déroutant
(404 sur des routes qui existent, pages d'une autre application). Pour
contourner sans arrêter l'autre service, tester depuis le réseau Docker :

```bash
docker exec mawid-backend wget -q -S -O /dev/null http://frontend:3000/pro
```

**Piège du build frontend en conteneur** : le service `frontend` tourne avec
`NODE_ENV=development`, ce qu'il faut pour le hot-reload. Mais lancer
`npm run build` dans ce conteneur sans surcharger la variable fait échouer la
génération statique de `/_global-error` sur un `TypeError: Cannot read
properties of null (reading 'useContext')` — React est alors chargé en mode
développement dans un build de production. La bonne commande est donc :

```bash
docker exec -e NODE_ENV=production mawid-frontend npm run build
```

La CI n'est pas concernée : elle construit hors conteneur, sans cette variable.

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

## 4. Plan de premier déploiement — 100 % gratuit

Objectif : mettre les 3 salons ambassadeurs en ligne sans dépenser un dinar
et **sans carte bancaire**. Ce dernier point est le critère décisif : Oracle
Cloud, Google Cloud et AWS offrent des paliers gratuits plus confortables,
mais exigent tous une carte pour la vérification d'identité, ce qui est un
point de friction réel depuis l'Algérie.

| Brique | Service | Plan | Carte ? |
| --- | --- | --- | --- |
| Base de données | **Neon** | Free (0,5 Go) | non |
| Backend NestJS | **Render** | Free Web Service (Docker) | non |
| Frontend Next.js | **Netlify** | Starter | non |
| Maintien à chaud + alertes | **UptimeRobot** | Free (5 min) | non |
| Suivi d'erreurs | **Sentry** | Developer (5 k/mois) | non |

### 4.1 Pourquoi ces choix précisément

- **Neon plutôt que Render Postgres** : la base Postgres gratuite de Render
  expire au bout de 30 jours. Surtout, Neon autorise les deux extensions dont
  le produit dépend :

  - **`btree_gist`** porte la contrainte d'exclusion anti-double-réservation,
    c'est-à-dire la colonne vertébrale du produit ;
  - **`unaccent`** rend la recherche insensible aux accents, sans quoi
    « elegance » ne trouve pas « Élégance » ni « epilation » ne trouve
    « Épilation » — personne ne tape les accents sur un téléphone.

  Critère éliminatoire, **à vérifier dès la création de la base** avant
  d'aller plus loin :

  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  CREATE EXTENSION IF NOT EXISTS unaccent;
  ```
- **Render pour le backend, avec maintien à chaud** : un service gratuit
  s'endort après 15 min d'inactivité et le réveil prend ~50 s. Inacceptable
  pour un produit qui promet « réserver en 60 secondes ». Un ping UptimeRobot
  toutes les 5 minutes sur `/api/health` le garde éveillé : ~730 h/mois, ce
  qui tient dans le budget gratuit de 750 h — **à condition qu'un seul
  service Render soit maintenu ainsi**. D'où le frontend ailleurs.
- **Netlify plutôt que Vercel** : le plan Hobby de Vercel est réservé à un
  usage **non commercial**. Mawid est un produit commercial : ce serait une
  violation de licence, pas une astuce. Le plan Starter de Netlify autorise
  l'usage commercial et gère Next.js sans adaptateur particulier.
  Cloudflare Pages conviendrait aussi, mais le SSR de Next.js y demande
  l'adaptateur OpenNext — du travail en plus pour un premier déploiement.
- **Pas de nom de domaine nécessaire pour démarrer** : `*.onrender.com` et
  `*.netlify.app` fournissent HTTPS automatiquement. Un domaine
  (~10-15 $/an) reste le seul poste qui finira par coûter, et uniquement
  pour la crédibilité commerciale auprès des salons.

### 4.2 Variables à positionner

Les fichiers `render.yaml` et `netlify.toml` à la racine décrivent les deux
services. Tout ce qui est marqué `sync: false` se saisit dans le tableau de
bord de l'hébergeur et ne transite jamais par le dépôt.

```bash
# Backend (Render)
DATABASE_URL=<chaîne Neon DIRECTE, sans -pooler, avec ?sslmode=require>
JWT_SECRET=<généré par Render, JAMAIS celui de docker-compose.yml>
FRONTEND_ORIGINS=https://mawid.netlify.app
TRUST_PROXY_HOPS=1          # Render termine le TLS et ajoute X-Forwarded-For
NODE_ENV=production

# Photos (docs/MVP_SCOPE.md, lot 15). Absentes : téléversement désactivé,
# le reste du produit fonctionne.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Notification des demandes (lot 16). Absentes : les demandes restent
# consultables dans /admin/demandes, aucun e-mail ne part.
RESEND_API_KEY=
MAWID_CONTACT_EMAIL=
MAWID_MAIL_FROM=Mawid <contact@mawid.dz>   # après vérification du domaine

# Frontend (Netlify)
NEXT_PUBLIC_API_URL=https://mawid-api.onrender.com/api
NEXT_PUBLIC_SITE_URL=https://maweid.netlify.app
# Absente tant que le produit est en test. Voir plus bas.
MAWID_ALLOW_INDEXING=
```

**Chaîne Neon : prendre la DIRECTE, pas la « pooled ».** `prisma migrate`
s'appuie sur des verrous consultatifs que le pooler de Neon ne conserve pas,
et le backend gère déjà son propre pool — en empiler deux n'apporte rien.

**`NEXT_PUBLIC_SITE_URL` n'est pas décorative** : sans elle, les liens de
gestion glissés dans les rappels WhatsApp, le sitemap et les métadonnées
Open Graph pointeraient tous vers `localhost`.

**`MAWID_ALLOW_INDEXING` decide si Google voit le site.** Absente ou
differente de `true`, `robots.txt` refuse tout le site et chaque page
porte `noindex, nofollow` : le produit reste accessible a qui a le lien,
mais n'entre pas dans l'index. Le defaut est ferme a dessein — un oubli
laisse le site discret, ce qui se repare en une variable, alors que
l'oubli inverse laisse des URL indexees qu'on ne retire pas facilement.
`robots.ts` et `sitemap.ts` sont generes a la CONSTRUCTION : poser la
variable sans redeployer n'a aucun effet. A ouvrir le jour du lancement,
et de preference une fois le domaine definitif en place, pour ne pas
faire indexer l'adresse Netlify provisoire.

**Ne pas positionner `BACKEND_INTERNAL_URL` sur Netlify.** En développement
elle désigne le réseau Docker interne ; sur Netlify ce réseau n'existe pas,
et `lib/api.ts` retombe correctement sur `NEXT_PUBLIC_API_URL`. La
renseigner ferait pointer le rendu serveur vers un hôte injoignable.

**Les migrations sont appliquées par Render au démarrage**
(`prisma migrate deploy` dans `startCommand`), pas depuis un poste de
développement : l'URL de production ne touche jamais une machine
personnelle, et un redéploiement suffit à mettre le schéma à jour.

`TRUST_PROXY_HOPS=1` est **la valeur exacte pour cette topologie**, et elle
n'est pas anodine : à 0, tous les clients partagent l'IP de Render et se
bloquent mutuellement au rate limiting ; avec `trust proxy: true` en aveugle,
n'importe qui peut forger `X-Forwarded-For` et le contourner entièrement. Si
Cloudflare est ajouté devant l'API plus tard, la valeur passe à 2.

### 4.3 Sauvegardes

`pg_dump` quotidien via `.github/workflows/backup.yml` (02h00 UTC, soit
03h00 à Alger), archivé en artefact pendant 30 jours. Le job tourne dans
l'image `postgres:16-alpine` : `pg_dump` refuse de fonctionner si sa version
majeure diffère de celle du serveur, et le paquet préinstallé du runner peut
changer sans prévenir.

**Un secret de dépôt `DATABASE_URL` est nécessaire** (Settings → Secrets and
variables → Actions). Sans lui, le job échoue franchement plutôt que de
produire une sauvegarde vide.

**Une restauration doit être testée une fois** : une sauvegarde jamais
restaurée n'est pas une sauvegarde. L'exercice, sur une branche Neon jetable
pour ne pas toucher la production :

```bash
# 1. Télécharger l'artefact depuis l'onglet Actions du dépôt
# 2. Créer une branche Neon de test, récupérer sa chaîne de connexion
pg_restore --no-owner --no-acl --dbname="<url-de-la-branche-de-test>" mawid-AAAA-MM-JJ.dump

# 3. Vérifier que l'essentiel est là — et surtout les extensions, sans
#    lesquelles la contrainte anti-double-réservation ne se recrée pas
psql "<url>" -c "SELECT extname FROM pg_extension WHERE extname IN ('btree_gist','unaccent');"
psql "<url>" -c "SELECT count(*) FROM reservations;"
```

### 4.4 Réserves honnêtes

- Les paliers gratuits changent souvent. Vérifier les conditions au moment
  de l'inscription plutôt que de faire confiance à ce document.
- Neon met la base en veille après inactivité, mais le réveil est inférieur
  à la seconde — sans commune mesure avec les 50 s de Render.
- 0,5 Go de base = des années de réservations à cette échelle.
- Trois fournisseurs = trois pannes possibles. C'est le prix du gratuit ; la
  migration vers un VPS unique (§4.5) supprime cette dispersion.

### 4.5 Quand ça paiera : la sortie de secours

Le code ne dépend d'**aucun SDK d'hébergeur** : tout passe par des variables
d'environnement. Migrer vers un VPS unique (~5 $/mois, ou une VM Oracle
« Always Free » si la carte de vérification n'est plus un obstacle) avec le
`docker-compose.yml` existant + Caddy consiste à changer trois variables et
à restaurer un `pg_dump`. `TRUST_PROXY_HOPS` reste à 1 derrière Caddy.

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
