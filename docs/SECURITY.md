# Sécurité — Mawid

Contexte : solo-founder, pas d'équipe sécurité dédiée, pas de RLS Postgres
(contrairement à ce que pourrait laisser penser un plan initial pensé pour
Supabase). La sécurité repose sur le code NestJS. Ce document est la
référence que Claude Code applique par défaut.

## 1. État réel du projet vs. ce document

Ce document décrit à la fois **ce qui existe déjà** dans le code et **ce qui
manque encore**. Ne pas supposer qu'une protection listée ici est en place
tant qu'elle n'a pas été vérifiée dans le code.

Déjà en place (bon niveau) :
- Mots de passe hashés avec `bcrypt`, jamais stockés en clair.
- Message d'erreur identique pour "téléphone inconnu" et "mot de passe
  incorrect" (protection anti-énumération de comptes).
- `ValidationPipe` global strict (`whitelist`, `forbidNonWhitelisted`,
  `transform`).
- DTOs avec bornes explicites (`@Min`/`@Max`) plutôt que des validations de
  type nues.
- Pattern "find scoped by owner, then act" dans `salons.service.ts`.
- `.env` correctement exclu du versioning, `.env.example` fourni sans valeurs
  réelles.

Ajouté au lot 2 (2026-09-17) :
- **Rate limiting** (`@nestjs/throttler`, guard global) : 120 req/min par
  défaut, 5 tentatives / 15 min sur `/auth/login` et `/auth/password`,
  20 réservations/h, 30 accès/h par token d'annulation. Toutes les valeurs
  sont surchargeables par variable d'environnement.
- **Helmet** dans `main.ts`. La CSP est désactivée volontairement : l'API ne
  sert que du JSON, une CSP pensée pour des pages HTML n'y apporte rien.
- **CORS par `FRONTEND_ORIGINS`**, et le démarrage **échoue** si la variable
  manque en production plutôt que de retomber silencieusement sur localhost.
- **Tests en CI** : `npm run test` est lancé par `ci.yml`.
- **bcrypt passé à 12 tours** : le login étant désormais limité à 5 essais par
  quart d'heure, le surcoût est invisible à l'usage mais rend une attaque hors
  ligne sur une base volée nettement plus chère.

Manquant à ce jour — à considérer comme prioritaire, pas optionnel :
- **`trust proxy` non configuré**. Derrière un reverse proxy, Express voit
  l'IP du proxy : tous les clients partageraient alors le même compteur de
  rate limiting et se bloqueraient mutuellement. À régler **en même temps**
  que le choix d'hébergement, sinon le throttling deviendra un déni de
  service involontaire.
- **CGNAT algérien** : les opérateurs mobiles partagent les IP publiques
  entre de nombreux abonnés. La limite de 20 réservations/h par IP pourrait
  bloquer de vrais clients — valeur à surveiller dès les premiers salons,
  ajustable via `THROTTLE_BOOKING_LIMIT`.
- **Stockage du throttling en mémoire** : les compteurs repartent à zéro à
  chaque redémarrage, et ne sont pas partagés entre instances. Acceptable sur
  une instance unique ; à basculer sur un stockage partagé le jour où il y en
  a plusieurs.
- **Révocation des JWT** : changer son mot de passe n'invalide pas les tokens
  déjà émis (24 h de validité). Nécessiterait un `tokenVersion` vérifié à
  chaque requête — à faire le jour où un compte est réellement compromis.
- **JWT_SECRET de dev codé en dur** dans `docker-compose.yml`
  (`dev-jwt-secret-change-me-in-production`) — acceptable en dev local, mais
  s'assurer qu'aucune configuration de production ne réutilise cette valeur
  ou n'hérite de ce fichier tel quel.

## 2. Authentification (gérants)

- Téléphone + mot de passe + JWT. Pas d'OTP SMS dans le code actuel — c'est
  une divergence assumée par rapport à d'anciens documents de planification
  produit ; ne pas réintroduire un flow OTP sans décision explicite.
- Points à durcir avant la mise en production :
  - Limiter les tentatives de connexion par IP et par numéro de téléphone
    (`@nestjs/throttler` est une option simple à intégrer).
  - Définir une politique de mot de passe minimale côté DTO d'inscription
    (longueur, pas de mot de passe trivial) — actuellement l'inscription
    n'est même pas encore un module visible dans `src/`, donc c'est le bon
    moment pour le faire dès sa création.
  - Prévoir la durée de vie du JWT (`JWT_EXPIRES_IN=24h` actuellement) et un
    mécanisme de révocation minimal si un compte est compromis (a minima :
    pouvoir changer le mot de passe invalide les anciens tokens si le
    `passwordHash` ou un `tokenVersion` est vérifié à chaque requête — à
    évaluer selon le besoin réel, ne pas sur-ingénierer trop tôt).

## 3. Autorisation et isolation multi-tenant (sans RLS)

- **Principe non négociable** : toute route qui lit ou modifie une ressource
  liée à un salon doit d'abord retrouver ce salon via l'utilisateur JWT
  authentifié (`ownerId = user.id`), jamais via un identifiant fourni tel
  quel par le client. C'est le seul mécanisme d'isolation entre salons —
  l'équivalent fonctionnel de RLS, mais appliqué manuellement dans chaque
  service.
- Chaque nouveau module métier (`reservations/`, futur `staff/`) doit
  répliquer le pattern de `salons.service.ts` :
  1. `findMine(userId)` → retrouve la ressource appartenant à l'utilisateur.
  2. Toute lecture/écriture ultérieure passe par l'`id` ainsi validé, jamais
     par un `id`/`salonId` brut venant du body ou de l'URL sans vérification.
- **Test obligatoire** pour toute nouvelle table sensible : un test qui crée
  deux salons (A et B), authentifie un gérant du salon A, et vérifie qu'il ne
  peut ni lire ni modifier une ressource du salon B (404 ou 403 attendu, pas
  une fuite de données).
- Les routes publiques (`GET /api/salons/:slug`, `GET /api/salons/:slug/prestations`)
  doivent continuer à ne sélectionner explicitement que les champs destinés à
  l'affichage public (déjà fait via `select` dans `findPublicBySlug` — garder
  cette discipline : ne jamais faire un `findUnique` sans `select` explicite
  sur une route publique, pour ne pas risquer d'exposer `ownerId` ou d'autres
  champs internes par erreur lors d'une future évolution du schéma).

## 4. Validation et sanitisation des entrées

- Tout DTO suit le modèle déjà en place : `class-validator` avec des bornes
  réalistes (voir `CreatePrestationDto`), pas de validation "type seulement".
- Les numéros de téléphone doivent être validés au format E.164 avant
  d'atteindre la base (actuellement stockés tels quels — un décorateur
  `@Matches` ou une lib de validation de téléphone dédiée est recommandé dès
  que le formulaire d'inscription/réservation est construit).
- Aucune requête SQL brute construite par concaténation : uniquement le
  client Prisma typé.
- Le futur upload de photos de salon (`Salon.photos: String[]`) devra limiter
  taille et type MIME des fichiers, et ne jamais faire confiance à
  l'extension seule.

## 5. Secrets et configuration

- Toutes les valeurs sensibles vivent en variables d'environnement :
  `DATABASE_URL`, `JWT_SECRET`, et à l'avenir toute clé SMS/WhatsApp/paiement.
- `.env`, `.env.local`, `.env.*.local` sont déjà correctement ignorés par Git
  (racine et `backend/`) — maintenir cette discipline pour tout nouveau
  fichier d'environnement ajouté (ex. `frontend/.env.local`).
- Avant la mise en production : générer un `JWT_SECRET` long et aléatoire
  distinct de la valeur de dev, le stocker uniquement dans la configuration
  de l'hébergeur choisi (jamais dans un fichier versionné).
- Si une clé a pu fuiter (même dans un commit ensuite supprimé, l'historique
  Git garde la trace), la considérer compromise et la régénérer.

## 6. Dépendances et supply chain

- `npm audit` régulièrement dans `backend/` et `frontend/`, en particulier
  avant un déploiement.
- Activer Dependabot (ou équivalent) sur le repo GitHub — pas encore visible
  dans `.github/`.
- Vérifier la fraîcheur de `bcrypt`, `passport-jwt`, `@prisma/client` en
  particulier : ce sont les briques qui protègent l'authentification et
  l'accès aux données.

## 7. Réseau et en-têtes HTTP

- CORS : remplacer l'origine codée en dur (`http://localhost:3000`) par une
  variable d'environnement (`FRONTEND_URL` ou équivalent) avant tout
  déploiement hors localhost.
- Ajouter Helmet (`@nestjs/helmet` ou le middleware `helmet` directement) pour
  les en-têtes de sécurité standards (`X-Content-Type-Options`,
  `X-Frame-Options`, etc.) — actuellement absent de `main.ts`.
- Prévoir un rate limiting global raisonnable en plus du rate limiting
  spécifique au login, pour limiter le scraping de la recherche publique de
  salons une fois cette route construite.

## 8. Logging et monitoring

- Aucun outil de monitoring d'erreurs n'est configuré à ce jour (pas de
  Sentry ni équivalent dans les dépendances). À prévoir avant la mise en
  production pour ne pas découvrir les bugs par les retours des gérants.
- Ne jamais logger : mot de passe (même hashé), JWT complet, `cancellationToken`
  de réservation, numéro de téléphone en clair dans des logs qui pourraient
  être partagés largement (masquer si besoin de debug, ex. `+213X XX XX 12`).

## 9. Conformité (loi algérienne 18-07)

- Le projet manipule des données personnelles (téléphone, historique de
  réservation) : prévoir CGU et politique de confidentialité en français
  (et arabe si le produit devient bilingue), et un mécanisme simple de
  suppression des données d'un client sur demande.
- Pas de mécanisme de consentement ou de suppression de données implémenté à
  ce jour dans le code — à prévoir avant la commercialisation réelle, pas
  nécessairement dès le MVP technique.

## 10. Checklist avant tout déploiement en production

- [ ] `JWT_SECRET` de production généré, distinct de la valeur de dev, jamais
      committé.
- [ ] CORS restreint au(x) domaine(s) réel(s) du frontend, plus de
      `localhost` en dur.
- [ ] Rate limiting actif sur `/api/auth/login` au minimum.
- [ ] Helmet ou équivalent activé.
- [ ] `npm audit` sans vulnérabilité critique/haute non traitée, sur les deux
      services.
- [ ] Tests exécutés (localement au minimum, idéalement en CI) et verts,
      y compris les tests d'isolation multi-tenant.
- [ ] Migrations Prisma appliquées proprement sur la base de production, pas
      de `prisma db push` non versionné.
- [ ] Aucun secret dans le diff du déploiement (vérification manuelle).

## 11. En cas d'incident suspecté

1. Couper l'accès concerné en premier (révoquer/rotater une clé, désactiver
   une route) plutôt que d'investiguer en laissant la faille ouverte.
2. Régénérer `JWT_SECRET` si un vol de token ou une fuite de secret est
   suspecté — cela invalide tous les tokens émis, donc prévenir que tous les
   gérants devront se reconnecter.
3. Vérifier les logs Postgres/backend disponibles pour évaluer l'ampleur.
4. Documenter brièvement l'incident (date, cause, correctif, impact) pour
   garder une trace utile en cas de future revue.
