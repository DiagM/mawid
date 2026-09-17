# Architecture technique — Mawid

## 1. Vue d'ensemble réelle

Monorepo à deux services + une base de données, orchestrés par Docker Compose
en dev :

```
mawid/
├── .github/workflows/ci.yml   # CI : lint + build + image Docker, par service
├── backend/                    # API NestJS
│   ├── src/
│   │   ├── auth/                # login téléphone + mot de passe → JWT
│   │   ├── salons/               # CRUD salon (public + "mon salon")
│   │   ├── prestations/          # CRUD prestations d'un salon
│   │   └── prisma/               # PrismaService, injecté partout
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── Dockerfile
├── frontend/                   # App Next.js (App Router)
│   ├── app/                     # encore le starter par défaut, à construire
│   ├── AGENTS.md                 # règles spécifiques Next.js pour l'agent
│   ├── CLAUDE.md                  # inclut AGENTS.md
│   └── Dockerfile
├── docs/                       # ARCHITECTURE, DATABASE, SECURITY, DEPLOYMENT, MVP_SCOPE
├── CLAUDE.md                   # instructions agent — reste à la racine
├── docker-compose.yml
└── .env.example
```

Ce qui **n'existe pas encore** dans le code (à ne pas supposer présent) :
- Toute page frontend au-delà du starter Next.js par défaut.
- Toute intégration WhatsApp/SMS côté serveur — par conception : c'est le
  téléphone du client qui envoie, via des liens `wa.me`.
- Tout rate limiting / throttling.
- Routes d'écriture des créneaux bloqués (la table est lue par le moteur de
  disponibilité, mais rien ne permet encore d'en créer).
- Création de compte gérant (ni script, ni route).

## 2. Stack détaillée

| Couche | Technologie | Détail |
| --- | --- | --- |
| Backend | NestJS 11 | modules par domaine métier |
| ORM | Prisma 7 + `@prisma/adapter-pg` | client généré, migrations versionnées |
| Base de données | PostgreSQL 16 (conteneur `postgres:16-alpine`) | pas de RLS, schéma unique |
| Auth | `@nestjs/jwt` + `passport-jwt` + `bcrypt` | téléphone + mot de passe, JWT stateless |
| Validation | `class-validator` + `class-transformer` | `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) |
| Frontend | Next.js (App Router), React 19, Tailwind v4 | TypeScript |
| Dev infra | Docker Compose | 3 services : `postgres`, `backend`, `frontend` |
| CI | GitHub Actions | job `backend` et job `frontend`, en parallèle |

Version Next.js : `frontend/package.json` déclare `next: 16.2.6` — le
`README.md` a été aligné (il annonçait "Next.js 15"). Penser à le réaligner
lors de toute montée de version majeure.

## 3. Autorisation — le vrai modèle de sécurité du projet

Il n'y a **pas de Row Level Security** (ce n'est pas Supabase). L'isolation
multi-tenant repose entièrement sur le code applicatif :

1. `JwtAuthGuard` protège les routes qui nécessitent un utilisateur connecté.
2. Le `JwtPayload` contient `sub` (id user), `phone`, `role`.
3. `@CurrentUser()` extrait l'utilisateur authentifié dans le controller.
4. Le service ne fait **jamais** confiance à un `salonId`/`id` fourni par le
   client pour une écriture : il retrouve toujours la ressource via
   `ownerId = user.id` d'abord (voir `salons.service.ts#findMine` /
   `#updateMine`), puis agit dessus.

Ce pattern ("find scoped by owner, then act") est la seule ligne de défense
contre un gérant qui modifierait les données d'un autre salon. Il doit être
répliqué à l'identique pour `prestations`, `blockedSlots`, et surtout pour le
futur module `reservations`.

## 4. Flux de données — réservation (implémenté)

Le flux ci-dessous est en place dans `backend/src/reservations/` :
`availability.service.ts` (lecture) et `reservations.service.ts` (écriture)
partagent le même `resolveContext`, pour que lecture et écriture appliquent
exactement les mêmes règles.

1. Client consulte `/api/salons/:slug` et `/api/salons/:slug/prestations`
   (routes publiques, déjà existantes).
2. `GET /api/salons/:slug/availability?date=…&prestationIds=…` croise horaires
   d'ouverture, réservations `CONFIRMED` et `BlockedSlot`. Le calcul est
   **exclusivement serveur** : le créneau affiché n'est jamais cru sur parole.
3. `POST /api/salons/:slug/reservations` — prénom + téléphone, pas de compte.
   Le serveur revalide tout : horaires, alignement sur la grille, délai
   minimum, horizon, durées et prix relus en base.
4. Insertion de la `Reservation` + ses `ReservationPrestation` (snapshots
   nom/prix/durée) dans une transaction.
5. **La contrainte d'exclusion Postgres arbitre les collisions**, pas le code.
   Une revérification applicative avant l'`INSERT` ne suffit pas : deux
   requêtes concurrentes la passent toutes les deux. Le code intercepte le
   `23P01` et renvoie un 409. Mesuré : 8 requêtes simultanées → 1 création,
   7 conflits base.
6. Le `cancellationToken` (`cuid`) est un secret porteur : il n'est renvoyé
   qu'à la création, jamais relu par l'API, n'apparaît dans aucun log, et la
   page de gestion n'expose ni note interne ni identifiant technique.

## 5. Environnements

| Environnement | Comment | Base de données |
| --- | --- | --- |
| Local (dev) | `docker compose up -d` | conteneur Postgres local, volume nommé `mawid_postgres_data` |
| CI | GitHub Actions, `prisma generate` avec `DATABASE_URL` factice | pas de vraie base, juste génération du client + lint + build |
| Production | **non décidé à ce jour** | à définir — voir `docs/DEPLOYMENT.md` |

## 6. Décisions à ne pas remettre en cause sans validation du fondateur

- Pas de compte client (le client réserve juste avec prénom + téléphone).
- Pas de multi-employés en V1 (`Salon.ownerId` unique, un seul "gérant" par
  salon dans le modèle actuel).
- Alger uniquement en V1 (`Salon.city` a une valeur par défaut `"Alger"`).
- Prix en centimes DZD entiers, jamais en flottant.
