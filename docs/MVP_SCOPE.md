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
| Statistiques (`GET /api/stats/me`) | ✅ Fait — avec période comparative |
| Quotas par offre (`GET /api/reservations/quota`) | ✅ Fait — Free 30 RDV/mois |
| Fiches clients (`GET /api/clients`) | ✅ Fait — scopées par salon |
| Segments de clientèle (`?segment=lapsed\|regulars`) | ✅ Fait |
| Changement d'offre et mise en avant (`npm run set-plan`) | ✅ Fait |
| Mise en avant payante (`Salon.featuredUntil`) | ✅ Fait — expire toute seule |
| Multi-villes (Alger, Oran, Constantine) | ✅ Fait |
| Caisse (`GET`/`POST`/`DELETE /api/cash`) | ✅ Fait |
| Stocks (`/api/products`, mouvements) | ✅ Fait |
| Abstraction paiement (`PaymentProvider`) | ✅ Fait — seule implémentation : sur place |
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
| Statistiques `/pro/statistiques` | ✅ Fait — 7/30/90 jours |
| Fiches clients `/pro/clients` et `/pro/clients/[id]` | ✅ Fait |
| Bandeau de quota (alerte à 80 %, blocage à 100 %) | ✅ Fait |
| Campagnes `/pro/campagnes` | ✅ Fait — liens `wa.me` personnalisés |
| Caisse `/pro/caisse` | ✅ Fait — journal, encaissement en un clic |
| Stock `/pro/stock` | ✅ Fait — entrées, sorties, alerte de seuil |

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

Statistiques livrées le 2026-09-20. Chaque indicateur est accompagné de la
**période précédente de même durée** : le chiffre brut ne dit rien tout seul,
la question utile au gérant est « est-ce que ça va mieux ? ».

Deux choix de calcul qui changent la lecture :
- le chiffre d'affaires ne compte **que** les rendez-vous honorés, et somme
  les snapshots de prix — changer un tarif ne réécrit pas l'historique ;
- le taux d'absence exclut les annulations du dénominateur. Annuler à
  l'avance est un comportement correct qui laisse au salon le temps de
  reprendre le créneau ; le mélanger aux absences brouillerait l'indicateur.

Reste : parrainage.

**Lot 6 — V3.** 🟡 En cours. Quotas et fiches clients livrés le 2026-09-20.

⚠️ **Décision produit lourde à connaître** : atteindre le quota Free fait
**refuser des clients réels**, qui n'y sont pour rien. C'est le mécanisme de
conversion voulu par le business plan §8.1 — un salon qui perd des
réservations a une raison concrète de passer au plan Pro — mais c'est la
seule fonctionnalité qui dégrade volontairement l'expérience du client final.
Deux garde-fous : le gérant est alerté dès 80 % du quota, et le message
renvoyé au client ne lui reproche rien et le renvoie vers le salon, qui peut
toujours le prendre par téléphone.

Les annulations ne sont pas imputées au quota : un client qui se décommande
n'a rien fait consommer au salon. Le décompte porte sur `createdAt` et non
`startsAt` — c'est l'acte de réserver qui est facturé, pas la date du RDV.

Les fiches clients n'exposent que ce que **ce** salon a vécu avec le client,
jamais ses rendez-vous ailleurs, alors même que l'entité `Client` est
partagée entre salons.

Interface livrée le 2026-09-20 : bandeau de quota visible depuis tous les
écrans du back-office, avec **deux niveaux distincts** — « bientôt à court »
laisse le temps de réagir, « limite atteinte » signale que des clients sont
déjà refusés. Confondre les deux ferait manquer la fenêtre où le gérant peut
encore agir. Plus les pages clients, liste et fiche détaillée.

Campagnes livrées le 2026-09-20. Mawid n'envoie rien : le gérant écrit son
message une fois, `{prenom}` est remplacé automatiquement, et chaque client
ouvre en un clic dans sa propre conversation WhatsApp. Ce qui est supprimé,
c'est le travail répétitif — pas l'envoi, qui reste le sien et qui est aussi
ce qui donne au message une chance d'être lu.

Segment `lapsed` par défaut : c'est la relance qui rapporte le plus. Il
exclut les clients ayant déjà un rendez-vous à venir — les relancer serait à
côté de la plaque — et ceux qui ne sont jamais venus.

Limite assumée : le suivi des envois vit en mémoire de la page. Il sert à ne
pas perdre sa place dans une liste de trente noms pendant une session, pas à
constituer un historique. C'est dit explicitement à l'écran plutôt que
laissé découvrir après un rechargement.

Mise en avant livrée le 2026-09-20, ce qui **clôt le lot 6**. Stockée en
`featuredUntil` (une date) plutôt qu'en booléen : un add-on se vend à la
semaine, et une date qui expire toute seule évite d'avoir à penser à la
retirer.

⚠️ **Piège évité** : un simple `orderBy: { featuredUntil: 'desc' }` aurait
été faux — une date expirée reste une date non nulle, donc un salon ayant
cessé de payer aurait continué de passer devant les autres. Le tri sépare
explicitement les deux populations sur la date du jour, en deux requêtes,
pour que la pagination reste exacte. Deux tests verrouillent ce
comportement.

La mise en avant est **annoncée explicitement** dans les résultats : un
classement payant non signalé tromperait le client sur la raison de ce
premier rang.

**Lot 7 — V4.** ✅ Livré le 2026-09-20. Multi-villes, caisse, stocks,
interface et abstraction paiement.

**Abstraction paiement** : `PaymentProvider` avec une seule implémentation,
`OnSitePaymentProvider`, qui ne fait rien — et c'est le but. Elle n'existe
pas pour faire fonctionner un paiement en ligne aujourd'hui, mais pour que
brancher SATIM plus tard soit un **ajout** : une seconde implémentation et
une variable d'environnement, sans qu'aucune route ni service métier ne
bouge. L'interface est volontairement minimale — l'étoffer par anticipation
la rendrait déjà spécifique à SATIM, ce qu'elle cherche justement à éviter.

**Multi-villes** : liste fermée (`common/cities.ts`). Accepter une chaîne
libre laisserait s'accumuler « alger », « Alger » et « Algers » comme trois
villes distinctes. Une ville ne s'ouvre qu'au moment où elle a des salons,
sinon le premier visiteur tombe sur une page vide.

**Caisse** : un salon encaisse aussi des clients **sans rendez-vous en
ligne**. Ne compter que les réservations Mawid donnerait au gérant un chiffre
systématiquement faux, et il continuerait de tenir son vrai cahier à côté.
Les rendez-vous honorés non encore encaissés sont proposés en un clic, pour
éviter la double saisie. Montants toujours positifs, c'est le type qui porte
le sens. Suppression réelle : un journal qui garde les lignes fausses n'en
est plus un.

**Stocks** : la quantité est dénormalisée sur le produit (lue en permanence)
mais **jamais écrite seule** — toujours dans la même transaction que le
mouvement qui la justifie. Elle n'est pas modifiable par `PATCH` : la changer
en direct rendrait l'historique faux sans prévenir. Un mouvement rendant le
stock négatif est refusé — un stock négatif n'existe pas physiquement, et
l'accepter masquerait l'erreur de saisie.

**Lot 8 — Console d'administration.** ✅ Livré le 2026-09-20. Validé
explicitement par le fondateur, hors roadmap du business plan.

**Pourquoi.** Tous les gestes d'exploitation — valider un salon inscrit,
changer une offre, vendre une mise en avant, dépanner un mot de passe —
passaient par des scripts en ligne de commande. Acceptable pour trois salons
ambassadeurs, intenable dès la dixième inscription : c'est ce qui bloquait le
passage à l'échelle commerciale, pas une fonctionnalité produit.

**Rôle ADMIN.** L'énumération `UserRole` déclarait `ADMIN` depuis le premier
schéma sans que rien ne l'utilise. `RolesGuard` lui donne enfin un sens.
Deux choix : refus par défaut quand aucun utilisateur n'est sur la requête —
oublier `JwtAuthGuard` doit produire un 403, jamais un accès libre — et rôle
relu **en base** à chaque requête, jamais dans le JWT, pour que retirer le
rôle coupe l'accès immédiatement.

**L'exception qui confirme la règle.** `AdminService` est le seul service du
projet à agir hors de tout périmètre de salon. Une erreur d'autorisation n'y
fuiterait pas les données d'un salon mais celles de **tous**, d'où un test de
bout en bout qui passe chaque route en revue avec un simple gérant.

**Modération des avis.** `Review.isPublished` existait et n'était exposé nulle
part : le code affirmait que « le retrait d'un avis abusif relève de la
plateforme » alors qu'aucune route ne permettait de le faire. On **masque**
plutôt qu'on supprime — effacer la ligne effacerait la trace de la modération
et rouvrirait la possibilité de redéposer un avis sur le même rendez-vous,
puisque l'unicité porte sur `reservationId`.

**Ce qui reste en ligne de commande** : la création du premier administrateur
(`prisma/create-admin.ts`), et elle y restera. Une route qui créerait le
premier compte administrateur devrait être ouverte à tous.

**Lot 9 — Équipe complète.** ✅ Livré le 2026-09-20.

**Le trou qu'il comble.** Le produit vendait du multi-employés depuis la V2,
mais le gérant n'avait aucun moyen de dire que Nadia ne travaille pas le
lundi : `Employee.workingHours` et `BlockedSlot.employeeId` existaient en
base, le moteur de disponibilité les respectait déjà, et **aucun formulaire
ne permettait de les renseigner**. `BlockedSlot.employeeId` n'était même pas
accepté par le DTO. Conséquence concrète : un jour d'absence fermait le salon
entier, y compris pour les collègues présents.

**Périmètre du conflit.** Un blocage ne regarde que les rendez-vous qu'il
peut réellement gêner : ceux du membre visé, ou tous quand le blocage vaut
pour le salon. Compter ceux des collègues rendrait impossible de poser un
congé dans un salon qui tourne.

**`null` n'est pas « fermé sept jours ».** `workingHours = null` fait suivre
les horaires du salon ; une semaine entièrement décochée rend le membre
indisponible en permanence. Deux intentions opposées, que l'interface sépare
par une case à cocher explicite plutôt que par l'absence de saisie.

**Ordre d'affichage.** Remonter un membre renumérote toute la liste côté
serveur au lieu d'échanger deux valeurs : `displayOrder` n'est pas unique et
vaut souvent 0 pour plusieurs membres, un échange entre deux zéros ne
changerait rien et le gérant cliquerait dans le vide.

## 6. Hors périmètre, quelle que soit la version

- Application mobile native — le business plan lui-même tranche : « PWA
  suffit ».
- OTP SMS — écarté par la contrainte de gratuité, et `CLAUDE.md` §3.4 exige
  une décision explicite du fondateur pour revenir dessus.
- Toute intégration facturée au message, à la transaction ou au mois, tant que
  la contrainte « zéro dépense » tient.
