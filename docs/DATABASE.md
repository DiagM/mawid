# Modèle de données — Mawid

Ce document explique le schéma **réellement défini** dans
`backend/prisma/schema.prisma` (migration `20260527082115_init`) et les
règles à respecter pour le faire évoluer. Le schéma Prisma reste la source de
vérité technique ; ce fichier en est le mode d'emploi.

## 1. Tables existantes

### `User` (`users`) — comptes gérants (et admin plateforme)
- `id` (cuid), `phone` (unique, E.164), `passwordHash` (bcrypt), `fullName?`,
  `role` (`MANAGER` | `ADMIN`, défaut `MANAGER`).
- `lastLogin`, `createdAt`, `updatedAt`.
- Relation : `salons Salon[]` — en V1, un gérant a toujours exactement un
  salon, mais le modèle autorise déjà plusieurs salons par gérant pour ne pas
  bloquer une évolution V2+. **Ne pas construire de logique qui suppose "1
  gérant = 1 salon" de façon rigide côté code** : utiliser `findFirst`
  (comme le fait déjà `findMine`), pas une contrainte unique implicite.

### `Salon` (`salons`)
- `id`, `slug` (unique, URL publique), `name`, `description?`.
- Adresse : `addressLine`, `district`, `city` (défaut `"Alger"`), `latitude?`,
  `longitude?`.
- `openingHours` (Json) — format libre actuellement, ex.
  `{ "monday": { "open": "09:00", "close": "20:00" }, "tuesday": null }`.
  **Ce champ n'est pas typé/validé au niveau base** : la validation doit se
  faire côté DTO si elle n'existe pas déjà (`UpdateSalonDto`) avant d'écrire
  en base.
- `photos` (String[] — URLs), `isActive` (Boolean, défaut `true`).
- `ownerId` → `User`, `onDelete: Cascade`.
- Relations : `prestations`, `blockedSlots`, `reservations`.

### `Prestation` (`prestations`)
- `id`, `salonId` → `Salon`.
- `name`, `description?`, `durationMinutes` (Int), `priceCents` (Int —
  **centimes DZD, jamais de flottant**), `isActive`, `displayOrder`.
- `onDelete: Cascade` avec le salon.

### `BlockedSlot` (`blocked_slots`)
- `id`, `salonId` → `Salon`.
- `startsAt`, `endsAt` (UTC), `reason?`.
- Sert à bloquer manuellement un créneau (pause, RDV perso, fermeture
  exceptionnelle) — distinct des réservations clients.

### `Reservation` (`reservations`) — cœur métier, **pas encore exposé par une API**
- `id`, `salonId` → `Salon`.
- `startsAt`, `endsAt` (UTC).
- Pas de compte client : `clientFirstName`, `clientPhone` (E.164) stockés en
  clair sur la réservation.
- `status` (`CONFIRMED` | `HONORED` | `NO_SHOW` | `CANCELED`, défaut
  `CONFIRMED`).
- `cancellationToken` (unique, cuid) — secret porteur permettant
  l'annulation/modification via un lien `wa.me` sans authentification. **À
  traiter comme une donnée sensible** (voir `docs/SECURITY.md` §3 et §8).
- `internalNote?` — privé, jamais exposé au client.
- Relation : `reservationPrestations`.

### `ReservationPrestation` (`reservation_prestations`) — table de jonction
- Permet une réservation avec plusieurs prestations (ex. coupe + barbe).
- Snapshot immuable au moment de la réservation : `nameSnapshot`,
  `priceCentsSnapshot`, `durationMinutesSnapshot` — pour préserver
  l'historique si le tarif change plus tard. **Toujours écrire ces snapshots
  à la création, ne jamais les recalculer a posteriori depuis `Prestation`.**
- `onDelete: Restrict` sur `prestation` : une prestation référencée par une
  réservation existante ne peut pas être supprimée physiquement — cohérent
  avec l'usage de `isActive` plutôt que la suppression pour "retirer" une
  prestation du catalogue public.

## 2. Ce qui manque encore (à construire, pas à supposer présent)

- Aucune route ne crée, lit, modifie ou annule de `Reservation` à ce jour :
  le module `reservations/` reste à créer côté `backend/src/`.
- Aucune logique de calcul de disponibilité (croisement horaires + réservations
  existantes + créneaux bloqués) n'existe encore.
- Pas encore de table `Employee`/multi-staff ni de table `Client` — mais elles
  sont désormais **anticipées volontairement** (voir §6) : l'objectif produit
  validé le 2026-09-17 est la solution complète V1→V4, ce qui constitue le
  « besoin confirmé » qui manquait.

## 3. Principes à respecter pour toute évolution de schéma

- Toute table métier liée à un salon garde un `salonId` en colonne directe
  (pas seulement via une relation indirecte), pour que le scoping par
  propriétaire reste simple à écrire côté service.
- Les montants restent en centimes, entiers.
- Les dates de réservation/blocage restent en UTC (`DateTime`), la conversion
  d'affichage se fait côté frontend.
- Toute donnée qui doit rester stable même si sa source change (comme le
  `nameSnapshot`/`priceCentsSnapshot` d'une prestation) doit être dupliquée
  explicitement au moment de l'écriture, pas recalculée par jointure.
- Pas de suppression physique d'une `Reservation` par défaut : un changement
  de `status` (`CANCELED`) est préférable pour garder l'historique utile aux
  futures statistiques — sauf demande explicite de suppression au titre d'un
  droit à l'effacement.

## 4. Workflow de migration

```bash
# Après modification de schema.prisma
docker exec -it mawid-backend npx prisma migrate dev --name <nom_explicite>

# Ou en local si Node/Postgres tournent hors Docker
npx prisma migrate dev --name <nom_explicite>

# Générer uniquement le client (déjà fait automatiquement par migrate dev)
npx prisma generate

# Explorer les données
npx prisma studio
```

- Toute migration est commitée dans `backend/prisma/migrations/` — jamais de
  modification manuelle du schéma de la base de production hors migration
  versionnée.
- La CI (`ci.yml`) exécute `npx prisma generate` avec une `DATABASE_URL`
  factice (pas de vraie connexion) uniquement pour que le typage TypeScript
  soit disponible au lint/build — elle n'applique aucune migration. Garder ce
  découplage : ne pas faire dépendre le build CI d'une vraie base de données.

## 5. Index déjà en place (à connaître avant d'ajouter une requête)

- `users(phone)` — recherche de compte au login.
- `salons(slug)`, `salons(ownerId)`.
- `prestations(salonId)`, `prestations(salonId, isActive)` — pense à la
  requête `findPublicBySlug` qui filtre justement sur ces deux colonnes.
- `blocked_slots(salonId, startsAt, endsAt)`.
- `reservations(salonId, startsAt)`, `reservations(clientPhone)`,
  `reservations(cancellationToken)`.

Avant d'ajouter une nouvelle requête fréquente (ex. calcul de disponibilité
par plage de dates), vérifier si un index existant la couvre déjà ou si une
migration d'index est nécessaire.

## 6. Ce qui est anticipé pour V2-V4, et ce qui ne l'est pas

L'objectif validé étant la solution complète V1→V4
(`docs/MVP_SCOPE.md` §1), le schéma est conçu dès maintenant pour l'accueillir.
Mais anticiper coûte : le critère retenu est **« est-ce cher à rattraper une
fois que de vrais salons tournent ? »**, pas « en aura-t-on besoin un jour ».

### 6.1 Anticipé maintenant (cher à rattraper)

- **`Employee` + `Reservation.employeeId`** — le multi-employés (V2) ne
  s'ajoute pas par-dessus un moteur de disponibilité écrit « par salon » :
  c'est le moteur lui-même qui change de nature. Le calcul de disponibilité
  est donc écrit **par ressource** dès la V1, avec une ressource unique et
  implicite (le gérant) tant que le salon n'a pas d'employés. L'UI V1 n'expose
  rien de tout cela ; la V2 est un déverrouillage, pas une réécriture.
- **`Client` (clé naturelle : téléphone E.164) + `Reservation.clientId`** —
  les fiches clients (V3), l'historique et le suivi des no-shows supposent une
  entité client. L'introduire après coup obligerait à reconstruire
  l'historique a posteriori à partir de colonnes brutes.
  `clientFirstName` reste stocké **en snapshot sur la réservation** (même
  logique que `nameSnapshot` pour les prestations) : le prénom au moment du
  RDV ne doit pas changer rétroactivement si la fiche client est corrigée.
- **Colonnes triviales mais structurantes** : `Salon.contactPhone` (numéro
  WhatsApp public, distinct de `User.phone` qui est l'identifiant de
  connexion), `Salon.isWomenOnly` (le filtre 100 % féminin est en V1 dans le
  business plan), `Salon.plan` (quotas V3), `User.mustChangePassword`.

### 6.2 Non anticipé (purement additif, à créer le moment venu)

`Review`, `Referral`, `CashMovement`, `Product`, `StockMovement`,
`Payment` : ce sont des tables nouvelles, sans modification de l'existant.
Les créer aujourd'hui serait de la sur-ingénierie — elles n'imposent aucune
contrainte rétroactive sur le modèle actuel.

### 6.3 Contrainte non exprimable en Prisma

L'anti-double-réservation repose sur une contrainte d'exclusion Postgres, que
Prisma ne sait pas générer. Elle est écrite à la main dans une migration créée
avec `prisma migrate dev --create-only` :

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    "salonId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');
```

Trois détails qui ne s'inventent pas :

- **`tsrange`, pas `tstzrange`** : Prisma mappe `DateTime` sur `TIMESTAMP(3)`
  *sans* fuseau. L'UTC est une convention applicative, pas un type SQL ici.
- **Colonnes en `camelCase` entre guillemets** : seules les *tables* sont
  renommées via `@@map`. Les colonnes gardent le nom du schéma Prisma
  (`"salonId"`, `"startsAt"`) et exigent donc des guillemets en SQL brut.
- **Borne haute ouverte `'[)'`** : deux RDV adjacents (10:00-10:30 puis
  10:30-11:00) ne se chevauchent pas. Avec `'[]'` le second serait rejeté.

Le filtre `WHERE (status = 'CONFIRMED')` est ce qui fait qu'une annulation
libère réellement le créneau.

Quand `Employee` sera exploité, la clé d'exclusion devra passer de `"salonId"`
à `COALESCE("employeeId", "salonId")` pour autoriser deux employés sur le même
créneau — d'où l'intérêt d'avoir la colonne dès le départ.

Toute écriture de réservation doit intercepter le code d'erreur Postgres
`23P01` (`exclusion_violation`) et le traduire en **409 Conflict**, jamais
laisser remonter une 500.

Comportement vérifié en base le 2026-09-17 : chevauchement rejeté en `23P01`,
créneau adjacent accepté, RDV passé en `CANCELED` qui libère son créneau.
