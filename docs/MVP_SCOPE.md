# Périmètre produit et état d'avancement — Mawid

Sources : business plan §7 (roadmap 24 mois) et état réel du code. Ce
document est la référence de périmètre : il dit **ce qui est décidé**, **ce
qui est fait**, et **ce qui est volontairement écarté**.

## 1. Objectif courant (décidé le 2026-09-17)

Construire la solution **complète, V1 à V4**, en n'utilisant que des moyens
**gratuits**. Aucune dépense côté fondateur pour l'instant — cette contrainte
peut être levée plus tard, l'architecture ne doit donc jamais rendre un
service payant impossible à brancher, seulement différé.

Conséquence directe : ce n'est plus « un MVP puis on verra ». L'ordre de
livraison reste V1 → V4, mais les décisions structurantes (schéma, moteur de
disponibilité) sont prises **dès maintenant en visant la V4**.

## 2. Roadmap du business plan (§7.2), relue sous contrainte « gratuit »

| Version | Contenu prévu | Verdict gratuité |
| --- | --- | --- |
| V1 | page salon, recherche ville/prestation + filtre 100 % féminin, réservation, agenda, onboarding self-service, WhatsApp | ✅ sauf OTP SMS et rappel J-1 automatique |
| V2 | multi-employés, avis, statistiques, parrainage, SEO | ✅ intégralement |
| V3 | tier Pro, fiches clients, campagnes WhatsApp, pack photos, mise en avant | ✅ sauf campagnes automatisées et pack photos |
| V4 | caisse, stocks, SATIM, multi-villes | ✅ sauf SATIM |

### 2.1 Ce qui est écarté par la contrainte « gratuit »

| Fonctionnalité | Pourquoi | Substitut retenu |
| --- | --- | --- |
| OTP SMS à la réservation | tout provider SMS est payant | aucun compte client, aucune vérification — rate limiting + blocage par numéro contre les fausses réservations |
| Rappel WhatsApp J-1 automatique | nécessite WhatsApp Cloud API (payant) | file « rappels du jour » en back-office, un clic = un `wa.me` pré-rempli, + fichier `.ics` qui sert de rappel natif |
| Campagnes WhatsApp marketing (V3) | idem | générateur de liens `wa.me` en lot, envoi manuel par le gérant |
| Prépaiement SATIM (V4) | contrat bancaire + 2 % / transaction | abstraction `PaymentProvider` + mode « acompte encaissé sur place » |
| Pack photos (V3) | prestation humaine, pas du logiciel | hors code |
| Encaissement des abonnements Pro | pas de passerelle gratuite | activation manuelle du plan après virement / espèces |

**Règle d'architecture qui en découle** : chaque substitut ci-dessus est
implémenté derrière une frontière explicite (service, interface) pour que
brancher le service payant plus tard soit un ajout, jamais une refonte.

## 3. Décisions validées le 2026-09-17

Ces huit points ont été proposés puis validés explicitement. Ils ne sont plus
à rediscuter, sauf décision contraire du fondateur.

1. **Notifications sans serveur d'envoi** — c'est le téléphone du client qui
   envoie : bouton « envoyer au salon » ouvrant `wa.me/<contactPhone>` avec un
   récapitulatif pré-rempli, plus un `.ics` contenant le lien de gestion, plus
   une page `/r/<cancellationToken>` (`noindex`, données minimales).
   Nécessite `Salon.contactPhone` — le numéro public du salon ne doit **pas**
   être `User.phone`, qui est l'identifiant de connexion du gérant.
2. **Règles de créneaux** (constantes dans
   `backend/src/reservations/booking-rules.ts`, surchargeables par env) :
   pas de 15 min, délai minimum 60 min avant le RDV, horizon 14 jours, durée
   cumulée maximale 180 min.
3. **Multi-prestations** : oui, plafonné à 3 prestations par réservation.
4. **Création de compte gérant** : script `create-manager` pour les salons
   ambassadeurs + `User.mustChangePassword` (mot de passe imposé au premier
   login) + `PATCH /api/auth/password`. L'onboarding self-service du business
   plan reste prévu (§5, lot 4) : il est gratuit à construire, mais les salons
   créés ainsi arrivent avec `isActive = false` et sont activés manuellement.
5. **Fuseau horaire** : helper unique
   `backend/src/common/time/algiers-time.ts`, `SALON_TIMEZONE =
   'Africa/Algiers'`, conversion via `Intl.DateTimeFormat` (pas d'offset `+1`
   codé en dur). Base et API en UTC ; les réponses exposent en plus un champ
   `localTime` pour éviter toute reconversion côté front.
6. **Anti-double-réservation** : contrainte d'exclusion Postgres
   (`btree_gist`, `EXCLUDE USING gist` sur `salon_id` + `tstzrange`, filtrée
   sur `status = 'CONFIRMED'`), migration écrite à la main via
   `prisma migrate dev --create-only`. Le code intercepte l'erreur Postgres
   `23P01` et renvoie un **409 Conflict**.
7. **Langue** : français seul, mais aucun libellé en dur dans les composants —
   tout passe par `frontend/lib/i18n/fr.ts`. L'arabe + RTL devient alors un
   fichier à traduire, pas une refonte. Pas de librairie i18n en V1.
8. **Hébergement gratuit** : option A = une VM Oracle Cloud « Always Free »
   avec le `docker-compose.yml` existant + Caddy (HTTPS automatique) ; option
   B de repli = Neon (Postgres) + Render (backend), avec le bémol du réveil à
   froid. Backups `pg_dump` quotidiens + Cloudflare R2. Sentry et UptimeRobot
   en plans gratuits. Aucune dépendance à un SDK d'hébergeur dans le code :
   CORS, URLs et secrets par variables d'environnement uniquement.

## 4. État d'avancement réel

### Backend

| Fonctionnalité | État |
| --- | --- |
| Auth gérant (login téléphone + mot de passe → JWT) | ✅ Fait |
| Fiche salon publique `GET /api/salons/:slug` | ✅ Fait |
| Gestion du salon `GET/PATCH /api/salons/me` | ✅ Fait |
| Prestations publiques `GET /api/salons/:slug/prestations` | ✅ Fait |
| CRUD prestations gérant (create/update/archive + isolation) | ✅ Fait |
| Calcul de disponibilité | ✅ Fait — `availability.service.ts`, moteur par ressource |
| Réservation client (`POST /api/salons/:slug/reservations`) | ✅ Fait — transactionnelle, 409 sur collision |
| Annulation par token (`GET`/`DELETE /api/reservations/token/:token`) | ✅ Fait |
| Agenda gérant (`GET /api/reservations/me`, `PATCH /:id/status`) | ✅ Fait |
| Création de compte gérant | ❌ À faire (lot 2) |
| Créneaux bloqués (table prête, lus par le moteur, aucune route d'écriture) | ❌ À faire (lot 2) |
| Recherche de salons (ville, prestation, filtre féminin) | ❌ À faire (lot 4) |
| Rate limiting, Helmet, CORS par env | ❌ À faire (lot 2) |
| Tests | 🟡 42 tests unitaires (temps, disponibilité, isolation A/B), lancés en CI. Pas encore de test d'intégration sur base réelle. |

### Frontend

Starter Next.js par défaut. **Aucune** page métier. Tout est à construire.

## 5. Ordre de construction

**Lot 0 — Schéma cible.** Pendant que la base est vide : `Salon.contactPhone`,
`Salon.isWomenOnly`, `Salon.plan`, `User.mustChangePassword`, table
`Employee`, table `Client`, `Reservation.employeeId`, `Reservation.clientId`,
contrainte d'exclusion. Voir `docs/DATABASE.md` §6 pour le raisonnement sur ce
qui est anticipé et ce qui ne l'est pas.

**Lot 1 — Module `reservations/`.** ✅ Livré le 2026-09-17. Moteur de
disponibilité par ressource, création transactionnelle, annulation par token,
agenda gérant. 42 tests unitaires, `npm run test` activé dans `ci.yml`.

Vérifié en conditions réelles : sur 8 requêtes simultanées visant le même
créneau, une seule réservation est créée et les 7 autres sont rejetées **par la
contrainte d'exclusion** (409), pas par le contrôle applicatif — les 8 avaient
toutes lu « créneau libre ». C'est la preuve que la vérification applicative
seule n'aurait pas suffi.

**Lot 2 — `blocked-slots/`, compte gérant, durcissement.** Routes d'écriture
des créneaux bloqués, script `create-manager` + `PATCH /auth/password`,
throttler sur le login et sur la création de réservation, Helmet, CORS par env.

**Lot 3 — Frontend V1.** Fiche salon publique, flow de réservation, page
`/r/<token>`, login + changement de mot de passe forcé, back-office (agenda,
salon, prestations, créneaux bloqués).

**Lot 4 — Complément V1 du business plan.** Recherche ville/prestation +
filtre 100 % féminin, SEO (metadata, sitemap, JSON-LD `LocalBusiness`), PWA,
onboarding self-service avec activation manuelle.

**Lot 5 — V2.** Multi-employés exposé dans l'UI (le moteur le supporte déjà),
avis clients (uniquement sur une réservation `HONORED`, pour couper court à
l'abus redouté dans le business plan), statistiques, parrainage.

**Lot 6 — V3.** Plans et quotas (Free 30 RDV/mois, Pro, Pro+), fiches
clients, campagnes `wa.me` manuelles, mise en avant.

**Lot 7 — V4.** Caisse, stocks, multi-villes, abstraction paiement.

## 6. Hors périmètre, quelle que soit la version

- Application mobile native — le business plan lui-même tranche : « PWA
  suffit ».
- OTP SMS — écarté par la contrainte de gratuité, et `CLAUDE.md` §3.4 exige
  une décision explicite du fondateur pour revenir dessus.
- Toute intégration facturée au message, à la transaction ou au mois, tant que
  la contrainte « zéro dépense » tient.
