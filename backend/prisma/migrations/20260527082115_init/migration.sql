-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'HONORED', 'NO_SHOW', 'CANCELED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "addressLine" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Alger',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "openingHours" JSONB NOT NULL,
    "photos" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "salons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestations" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slots" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "clientFirstName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancellationToken" TEXT NOT NULL,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_prestations" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "prestationId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceCentsSnapshot" INTEGER NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,

    CONSTRAINT "reservation_prestations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "salons_slug_key" ON "salons"("slug");

-- CreateIndex
CREATE INDEX "salons_slug_idx" ON "salons"("slug");

-- CreateIndex
CREATE INDEX "salons_ownerId_idx" ON "salons"("ownerId");

-- CreateIndex
CREATE INDEX "prestations_salonId_idx" ON "prestations"("salonId");

-- CreateIndex
CREATE INDEX "prestations_salonId_isActive_idx" ON "prestations"("salonId", "isActive");

-- CreateIndex
CREATE INDEX "blocked_slots_salonId_startsAt_endsAt_idx" ON "blocked_slots"("salonId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_cancellationToken_key" ON "reservations"("cancellationToken");

-- CreateIndex
CREATE INDEX "reservations_salonId_startsAt_idx" ON "reservations"("salonId", "startsAt");

-- CreateIndex
CREATE INDEX "reservations_clientPhone_idx" ON "reservations"("clientPhone");

-- CreateIndex
CREATE INDEX "reservations_cancellationToken_idx" ON "reservations"("cancellationToken");

-- CreateIndex
CREATE INDEX "reservation_prestations_reservationId_idx" ON "reservation_prestations"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_prestations_reservationId_prestationId_key" ON "reservation_prestations"("reservationId", "prestationId");

-- AddForeignKey
ALTER TABLE "salons" ADD CONSTRAINT "salons_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestations" ADD CONSTRAINT "prestations_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slots" ADD CONSTRAINT "blocked_slots_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_prestations" ADD CONSTRAINT "reservation_prestations_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_prestations" ADD CONSTRAINT "reservation_prestations_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "prestations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
