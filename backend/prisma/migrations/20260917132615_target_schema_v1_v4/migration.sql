/*
  Warnings:

  - Added the required column `clientId` to the `reservations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contactPhone` to the `salons` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SalonPlan" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- AlterTable
ALTER TABLE "blocked_slots" ADD COLUMN     "employeeId" TEXT;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "clientId" TEXT NOT NULL,
ADD COLUMN     "employeeId" TEXT;

-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "contactPhone" TEXT NOT NULL,
ADD COLUMN     "isWomenOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" "SalonPlan" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "workingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_salonId_idx" ON "employees"("salonId");

-- CreateIndex
CREATE INDEX "employees_salonId_isActive_idx" ON "employees"("salonId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "blocked_slots_employeeId_startsAt_endsAt_idx" ON "blocked_slots"("employeeId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "reservations_employeeId_startsAt_idx" ON "reservations"("employeeId", "startsAt");

-- CreateIndex
CREATE INDEX "reservations_clientId_idx" ON "reservations"("clientId");

-- CreateIndex
CREATE INDEX "salons_city_isActive_idx" ON "salons"("city", "isActive");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- Anti-double-réservation — écrit à la main
-- ============================================
-- Prisma ne sait pas exprimer une contrainte d'exclusion, d'où cette section
-- ajoutée manuellement (migration créée avec --create-only).
--
-- Pourquoi une contrainte base et pas une vérification applicative : un
-- "SELECT puis INSERT" côté service laisse toujours passer deux requêtes
-- simultanées visant le même créneau. Seule la base peut arbitrer.
--
-- tsrange (et non tstzrange) : Prisma mappe DateTime sur TIMESTAMP(3) sans
-- fuseau. Les valeurs sont stockées en UTC par convention applicative.
--
-- Le filtre sur CONFIRMED est essentiel : annuler un RDV doit libérer le
-- créneau, sinon un client qui annule bloquerait son horaire à vie.
--
-- V2 : quand les employés seront exploités, la clé devra passer de "salonId"
-- à COALESCE("employeeId", "salonId") pour autoriser deux employés sur le
-- même créneau. Voir docs/DATABASE.md §6.3.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    "salonId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');
