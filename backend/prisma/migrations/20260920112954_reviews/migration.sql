-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservationId_key" ON "reviews"("reservationId");

-- CreateIndex
CREATE INDEX "reviews_salonId_isPublished_createdAt_idx" ON "reviews"("salonId", "isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_employeeId_idx" ON "reviews"("employeeId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
