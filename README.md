# Mawid

> Ton rendez-vous beauté, en 60 secondes.

[![CI](https://github.com/DiagM/mawid/actions/workflows/ci.yml/badge.svg)](https://github.com/DiagM/mawid/actions/workflows/ci.yml)

Plateforme de réservation pour salons de beauté en Algérie. Application web mobile-first, sans création de compte ni installation pour le client final.

## Stack

- **Frontend** : Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Backend** : NestJS (TypeScript)
- **Base de données** : PostgreSQL 16 + Prisma ORM
- **Infrastructure** : Docker Compose
- **CI** : GitHub Actions

## Démarrage rapide

### Pré-requis

- Docker Desktop (ou Docker Engine + Docker Compose)

### Lancement

```bash
git clone https://github.com/DiagM/mawid.git
cd mawid

# Copier le fichier d'environnement d'exemple
cp .env.example .env

# Démarrer les 3 services (postgres + backend + frontend)
docker compose up -d
```

Les services sont disponibles sur :

- Frontend : http://localhost:3000
- Backend API : http://localhost:3001/api
- PostgreSQL : `localhost:5433` (utilisateur `mawid`, base `mawid`)

### Commandes utiles

```bash
# Voir les logs en direct
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend

# Arrêter les services (les données restent)
docker compose down

# Tout réinitialiser, y compris la base de données
docker compose down -v

# Reconstruire après une modification du Dockerfile ou de package.json
docker compose up -d --build

# Ouvrir un shell SQL dans Postgres
docker exec -it mawid-postgres psql -U mawid -d mawid

# Lancer une commande Prisma dans le conteneur backend
docker exec -it mawid-backend npx prisma migrate dev
```

## Structure du projet

```
mawid/
├── .github/workflows/    # GitHub Actions (CI/CD)
├── backend/              # API NestJS
│   ├── src/              # Code source
│   ├── prisma/           # Schéma et migrations Prisma
│   └── Dockerfile
├── frontend/             # App Next.js
│   ├── app/              # Routes (App Router)
│   └── Dockerfile
└── docker-compose.yml    # Orchestration
```

## Périmètre V1

La V1 livre le strict minimum permettant à un client de réserver un créneau et à un gérant de gérer son agenda. Les fonctionnalités avancées (multi-employés, statistiques, paiement, rappels automatiques) sont reportées aux versions V2 à V4, déclenchées par des jalons de traction.

Le cahier des charges détaillé est disponible en interne.

## Licence

Tous droits réservés. Projet privé.
