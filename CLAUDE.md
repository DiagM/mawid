# CLAUDE.md — Instructions projet Mawid

> Ce fichier est lu automatiquement par Claude Code au démarrage de chaque
> session. Il doit rester à la racine du repo. Les documents détaillés sont
> dans `docs/`. Le dossier `frontend/` a son propre `CLAUDE.md` (qui pointe
> vers `frontend/AGENTS.md`, des règles Next.js spécifiques) : ce fichier
> racine s'applique à tout le monorepo, `frontend/CLAUDE.md` s'ajoute par-dessus
> quand on travaille dans `frontend/`.

## 1. Contexte du projet

Mawid est une plateforme de réservation en ligne pour les salons de beauté en
Algérie (V1 : Alger uniquement). Deux usages :

- **Client final** : trouve un salon, réserve un créneau en quelques écrans,
  **sans créer de compte** (juste prénom + téléphone).
- **Gérant** : se connecte (téléphone + mot de passe), gère son salon, ses
  prestations et ses créneaux bloqués.

La V1 livre le strict minimum permettant à un client de réserver et à un
gérant de gérer son agenda. Le reste (multi-employés, statistiques, paiement,
rappels automatiques WhatsApp/SMS) est reporté aux versions suivantes — voir
`docs/MVP_SCOPE.md`.

**Solo founder / solo dev.** Aucune revue de code humaine systématique :
Claude Code est le principal filet de sécurité avant la prod. Être plus
strict que la moyenne sur la sécurité, les tests et la lisibilité.

## 2. Stack réelle (référence : `docs/ARCHITECTURE.md`)

- **Backend** : NestJS 11 (TypeScript), Prisma 7 (`@prisma/adapter-pg`) sur
  PostgreSQL 16, validation via `class-validator` / `class-transformer`,
  auth JWT (`@nestjs/jwt`, `passport-jwt`), mots de passe hashés `bcrypt`.
- **Frontend** : Next.js (App Router, actuellement quasi vide — starter par
  défaut), React 19, Tailwind CSS v4, TypeScript.
- **Infra dev** : Docker Compose (`postgres`, `backend`, `frontend`).
- **CI** : GitHub Actions (`.github/workflows/ci.yml`) — lint, build, tests
  unitaires, tests de bout en bout et image Docker pour chaque service. Le job
  backend démarre un service PostgreSQL 16 et applique les migrations sur une
  base jetable `mawid_test` avant les E2E.

Pas de Supabase, pas de RLS, pas de WhatsApp Cloud API, pas d'OTP SMS dans le
code à ce jour — ne pas supposer leur présence en lisant d'anciennes notes de
planification. L'autorisation se fait entièrement dans la couche service
NestJS (voir §3.2).

## 3. Règles impératives (non négociables)

### 3.1 Secrets
- Jamais de secret (`JWT_SECRET`, futurs tokens SMS/WhatsApp, credentials DB)
  en dur dans le code ou committé. Tout passe par variables d'environnement
  (`.env`, jamais versionné — déjà dans `.gitignore`).
- Le `JWT_SECRET` de dev dans `docker-compose.yml`
  (`dev-jwt-secret-change-me-in-production`) ne doit **jamais** se retrouver
  en production. Voir `docs/SECURITY.md` §5.

### 3.2 Autorisation — pas de RLS, donc scoping manuel obligatoire
Il n'y a pas de Row Level Security côté base. **Toute la sécurité tient au
code du service NestJS.** Le pattern déjà en place dans `salons.service.ts`
doit être répliqué partout :
- Ne jamais faire confiance à un `salonId` envoyé par le client pour une
  action d'écriture. Toujours retrouver le salon via `ownerId = user.id`
  (extrait du JWT), puis agir sur cet enregistrement.
- Toute nouvelle route protégée passe par `JwtAuthGuard` et récupère
  l'utilisateur via `@CurrentUser()`, jamais via un paramètre de route ou de
  body non vérifié.
- Toute nouvelle fonctionnalité multi-tenant (prestations, créneaux bloqués,
  réservations) a un test qui vérifie qu'un gérant du salon A ne peut ni lire
  ni modifier les données du salon B.

### 3.3 Validation
- Toute entrée passe par un DTO `class-validator` avec des bornes explicites
  (comme `CreatePrestationDto` : `@Min`/`@Max` sur les durées et prix, pas de
  validation "juste un type"). Le `ValidationPipe` global (`whitelist: true`,
  `forbidNonWhitelisted: true`) doit rester actif dans `main.ts`.
- Les numéros de téléphone sont stockés et comparés au format E.164
  (`+213...`), comme le fait déjà le schéma Prisma.

### 3.4 Mots de passe et auth
- Auth actuelle = téléphone + mot de passe (`bcrypt`) + JWT, **pas** d'OTP SMS
  malgré ce que peuvent indiquer d'anciens documents de planification produit.
  Si cette décision doit changer, c'est un choix produit à valider
  explicitement avec l'utilisateur, pas une modification silencieuse.
- Ne jamais renvoyer un message d'erreur différenciant "téléphone inconnu" de
  "mot de passe incorrect" — `auth.service.ts` fait déjà ça bien, garder ce
  comportement dans tout code d'auth ajouté (mot de passe oublié, etc.).

### 3.5 Argent
- Les prix sont stockés en **centimes DZD, entiers** (`priceCents`), jamais en
  flottant. Respecter cette convention pour toute nouvelle donnée monétaire.

## 4. Conventions de code déjà en place

- TypeScript strict, pas de `any` non justifié.
- ESLint + Prettier (`npm run lint` dans `backend/` et `frontend/`).
- Backend : architecture par module NestJS (`auth/`, `salons/`, `prestations/`,
  `prisma/`) — un nouveau domaine métier (ex. `reservations/`) suit le même
  découpage : `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.
- Commentaires en français, orientés "pourquoi" plus que "quoi" (cf. les
  commentaires sur les bornes de validation ou les choix de modélisation dans
  `schema.prisma`) — garder ce style.
- Prisma : les **tables** sont renommées en `snake_case` via `@@map`
  (`reservation_prestations`), mais les **colonnes** gardent leur nom
  `camelCase` (`"salonId"`, `"startsAt"`) — aucun `@map` de champ n'est
  utilisé. En SQL brut, elles exigent donc des guillemets doubles.

## 5. Workflow attendu de Claude Code

Avant toute tâche de développement :
1. Lire `docs/ARCHITECTURE.md` pour la structure réelle du monorepo.
2. Lire `docs/DATABASE.md` avant toute modification de `schema.prisma` ou de
   requête Prisma.
3. Lire `docs/SECURITY.md` avant toute tâche touchant à l'auth, aux données
   personnelles, ou à une nouvelle route.
4. Vérifier `docs/MVP_SCOPE.md` avant d'implémenter une fonctionnalité —
   signaler explicitement tout écart plutôt que d'étendre le périmètre
   silencieusement.

Pour toute nouvelle fonctionnalité touchant aux données :
- Écrire la migration Prisma et la logique de scoping par `ownerId`/`salonId`
  **avant** le reste du code applicatif.
- Écrire au moins un test qui vérifie l'isolation entre deux salons.
- Lancer `npm run lint`, `npm run build`, `npm run test` et
  `npm run test:e2e` (backend) avant de considérer la tâche terminée. Les
  quatre tournent déjà en CI : une tâche qui casse l'un d'eux casse `main`.

## 6. Commandes utiles

```bash
# Environnement complet (recommandé)
docker compose up -d
docker compose logs -f backend

# Backend (dans backend/)
npm run start:dev        # dev avec watch
npm run lint
npm run build
npm run test              # tests unitaires (doubles, aucune base)
npm run test:e2e          # bout en bout — exige la base mawid_test,
                          # voir backend/test/README.md
npx prisma migrate dev    # nouvelle migration
npx prisma studio         # explorer la base

# Frontend (dans frontend/)
npm run dev
npm run lint
npm run build
```

## 7. Definition of Done

Une tâche n'est terminée que si :
- [ ] Lint + build passent sur le(s) service(s) touché(s).
- [ ] Aucune route/service ne fait confiance à un identifiant de tenant fourni
      par le client sans le recouper avec l'utilisateur JWT authentifié.
- [ ] Un test d'isolation multi-tenant existe pour toute nouvelle table
      sensible (ou table existante nouvellement exposée en écriture).
- [ ] Aucun secret exposé côté client ni committé.
- [ ] Les migrations Prisma sont commitées et appliquées proprement en local
      avant de proposer la tâche comme terminée.
- [ ] Aucune fonctionnalité hors périmètre MVP courant n'a été ajoutée sans
      validation explicite (`docs/MVP_SCOPE.md`).
