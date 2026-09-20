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
| Créneaux bloqués (`GET`/`POST`/`DELETE /api/blocked-slots`) | ✅ Fait |
| Création de compte gérant (`npm run create-manager`) | ✅ Fait — onboarding ambassadeurs |
| Inscription self-service (`POST /api/auth/register`) | ✅ Fait — salon inactif jusqu'à validation |
| Validation d'un salon (`npm run activate-salon`) | ✅ Fait |
| Changement de mot de passe (`PATCH /api/auth/password`) | ✅ Fait — forcé au premier login |
| Rate limiting, Helmet, CORS par env | ✅ Fait |
| Recherche de salons (`GET /api/salons`, `?city`, `?q`, `?womenOnly`) | ✅ Fait |
| Sitemap (`GET /api/salons/sitemap`) | ✅ Fait |
| Multi-employés (`/api/employees`, moteur par ressource) | ✅ Fait |
| Avis clients (`POST /api/reservations/token/:token/review`) | ✅ Fait — verrou token + HONORED |
| Tests | 🟡 51 tests unitaires lancés en CI. Pas encore de suite d'intégration automatisée sur base réelle (l'isolation A/B a été vérifiée manuellement sur deux salons). |

### Frontend

| Écran | État |
| --- | --- |
| Accueil et recherche | ✅ Fait — formulaire en GET, URL partageable |
| SEO (`sitemap.xml`, `robots.txt`, JSON-LD) | ✅ Fait |
| Inscription salon `/pro/inscription` | ✅ Fait — seule page pro indexable |
| PWA (manifeste) | ✅ Fait — sans service worker, cf. lot 4 |
| Fiche salon publique `/[slug]` | ✅ Fait |
| Tunnel de réservation `/[slug]/reserver` | ✅ Fait — 3 étapes, mobile-first |
| Confirmation (wa.me + `.ics` + lien de gestion) | ✅ Fait |
| Gestion/annulation client `/r/[token]` | ✅ Fait — `noindex, nofollow` |
| Connexion gérant `/pro/connexion` | ✅ Fait — JWT en cookie `httpOnly` |
| Changement de mot de passe forcé `/pro/mot-de-passe` | ✅ Fait |
| Agenda `/pro` | ✅ Fait — qualification des RDV, total du jour |
| Mon salon `/pro/salon` | ✅ Fait — infos et horaires |
| Prestations `/pro/prestations` | ✅ Fait — création, archivage, réactivation |
| Indisponibilités `/pro/indisponibilites` | ✅ Fait |
| Équipe `/pro/equipe` | ✅ Fait — ajout, archivage, réactivation |
| Choix du membre dans le tunnel client | ✅ Fait — masqué si le salon n'a pas d'équipe |
| Avis : dépôt, fiche salon, recherche, `/pro/avis` | ✅ Fait |

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

**Lot 2 — `blocked-slots/`, compte gérant, durcissement.** ✅ Livré le
2026-09-17. Routes d'écriture des créneaux bloqués (refus de bloquer une
période contenant des RDV confirmés), script `create-manager` avec mot de
passe généré et changement forcé au premier login, throttling, Helmet, CORS
par variable d'environnement.

Isolation vérifiée sur l'API réelle avec deux salons distincts : le gérant A
reçoit un 403 sur un créneau bloqué du salon B, ne voit ni ses réservations,
ni ses prestations, ni ses blocages.

**Lot 3a — Frontend, parcours client.** ✅ Livré le 2026-09-18. Fiche salon,
tunnel de réservation en 3 étapes, confirmation avec `wa.me` + `.ics` + lien
de gestion, page `/r/<token>` avec annulation.

Trois règles du linter React de cette version ont orienté le code, et méritent
d'être connues avant d'écrire un nouvel écran : pas de JSX dans un `try/catch`
(`react-hooks/error-boundaries`), pas de `setState` dans un effet
(`react-hooks/set-state-in-effect`), pas d'appel impur comme `Date.now()`
pendant le rendu (`react-hooks/purity`). Conséquence pratique : le chargement
des créneaux se fait dans les gestionnaires d'événements et non dans un
`useEffect`, et les valeurs dépendant de l'heure ou de l'URL sont calculées
côté serveur puis passées en props.

**Lot 3b — Frontend, back-office gérant.** ✅ Livré le 2026-09-18. Connexion,
changement de mot de passe forcé, agenda, gestion du salon, des prestations et
des indisponibilités.

Choix structurant : le JWT vit dans un cookie `httpOnly`, jamais dans
`localStorage`. Un jeton lisible par JavaScript serait récupérable par toute
faille XSS, et il donne accès à l'agenda complet d'un salon et aux numéros de
tous ses clients. Conséquence : toutes les pages du back-office sont des
composants serveur et toutes les écritures passent par des Server Actions.

⚠️ Une Server Action est joignable par un POST direct, sans passer par
l'interface. Chacune vérifie donc la session elle-même — un contrôle unique
dans le layout ne protégerait rien. Le layout ne fait qu'afficher la
navigation.

Isolation vérifiée sur l'interface réelle avec deux salons : le gérant A ne
voit ni les prestations, ni le salon, ni l'agenda du salon B, et
réciproquement. Le JWT n'apparaît dans aucune page servie.

**Lot 4 — Complément V1 du business plan.** 🟡 Partiellement livré le
2026-09-18 : recherche (ville, texte libre sur salon/quartier/prestation,
filtre 100 % féminin), `sitemap.xml`, `robots.txt`, données structurées
`HealthAndBeautyBusiness`, manifeste PWA.

Pas de service worker volontairement : un cache hors ligne sur des créneaux de
réservation afficherait des disponibilités périmées, ce qui est pire qu'une
page qui ne charge pas.

Onboarding self-service livré : `POST /api/auth/register` crée le gérant et
son salon **inactif**, invisible en recherche et en 404 sur sa fiche publique
jusqu'à validation par `npm run activate-salon`. C'est ce qui rend l'ouverture
de cette route acceptable sans vérification d'identité — un faux salon
n'atteint aucun client. Le gérant est connecté immédiatement pour préparer ses
prestations, avec un bandeau qui lui explique pourquoi il n'est pas encore
visible.

Le refus d'un numéro déjà inscrit ne le confirme pas : sans cette précaution,
la route deviendrait un oracle permettant d'énumérer les gérants inscrits.

La recherche utilise l'extension `unaccent` : sans elle, « elegance » ne
trouve pas « Élégance » ni « epilation » ne trouve « Épilation » — personne ne
tape les accents sur un téléphone. C'est la **deuxième extension Postgres
requise** après `btree_gist`, à vérifier à la création de la base de
production (`docs/DEPLOYMENT.md` §4.1).

Bug rattrapé au passage : `contactPhone` et `isWomenOnly`, ajoutés au schéma au
lot 0, n'avaient jamais été ajoutés au `select` de la fiche publique. Le lien
téléphone, le badge « 100 % féminin » et le `telephone` des données
structurées étaient donc vides — et le repli `wa.me` de l'écran de
confirmation aurait été cassé. Deux tests verrouillent désormais ce `select`.

**Lot 5 — V2.** 🟡 En cours. Multi-employés backend livré le 2026-09-19 :
migration de la contrainte d'exclusion vers `COALESCE(employeeId, salonId)`,
CRUD `/api/employees`, moteur de disponibilité par employé, choix du membre
côté client, équipe exposée sur la fiche publique.

Interface livrée le 2026-09-19 : `/pro/equipe` (ajout, archivage,
réactivation) et sélecteur « Avec qui ? » dans le tunnel client, masqué tant
que le salon n'a pas d'équipe — le parcours d'un salon solo reste identique
à la V1.

Avis livrés le 2026-09-20. Le « potentiel d'abus » que redoutait le business
plan est traité **structurellement** : il faut détenir le `cancellationToken`,
le rendez-vous doit être `HONORED`, et `reservationId` est unique — un
passage, un avis. Personne ne peut noter un salon où il n'est jamais allé.

`isPublished` n'est **pas** accessible au gérant : un salon capable de masquer
ses mauvaises notes rendrait le système sans valeur. `/pro/avis` est en
lecture seule.

Reste : statistiques, parrainage.

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
