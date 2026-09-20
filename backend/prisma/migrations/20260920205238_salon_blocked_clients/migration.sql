-- CreateTable
CREATE TABLE "salon_blocked_clients" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salon_blocked_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salon_blocked_clients_clientId_idx" ON "salon_blocked_clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "salon_blocked_clients_salonId_clientId_key" ON "salon_blocked_clients"("salonId", "clientId");

-- AddForeignKey
ALTER TABLE "salon_blocked_clients" ADD CONSTRAINT "salon_blocked_clients_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salon_blocked_clients" ADD CONSTRAINT "salon_blocked_clients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
