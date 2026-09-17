/**
 * ============================================
 * Mawid — Seed initial
 * ============================================
 * Insère des données de test pour développer plus facilement :
 *   - 1 gérant (Karim) avec mot de passe haché
 *   - 1 salon (Karim Barber Shop à Bab Ezzouar)
 *   - 5 prestations standards (coupe, barbe, etc.)
 *
 * Lancer : docker exec -it mawid-backend npx prisma db seed
 *
 * Idempotent : peut être relancé sans créer de doublons.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Démarrage du seed Mawid...\n');

  // ---- 1. Gérant Karim ----
  const karimPhone = '+213555100001';
  const karimPasswordHash = await bcrypt.hash('karim1234', 10);

  const karim = await prisma.user.upsert({
    where: { phone: karimPhone },
    update: {},
    create: {
      phone: karimPhone,
      passwordHash: karimPasswordHash,
      fullName: 'Karim Benali',
      role: 'MANAGER',
    },
  });
  console.log(`✅ Gérant créé : ${karim.fullName} (${karim.phone})`);

  // ---- 2. Salon Karim Barber Shop ----
  const salon = await prisma.salon.upsert({
    where: { slug: 'karim-barber' },
    // On réaligne le numéro public à chaque seed : c'est lui qui porte tout le
    // flux de confirmation wa.me, une valeur absente casserait le parcours.
    update: { contactPhone: '+213555100002' },
    create: {
      slug: 'karim-barber',
      name: 'Karim Barber Shop',
      // Numéro WhatsApp public du salon, volontairement différent du numéro
      // de connexion de Karim (+213555100001).
      contactPhone: '+213555100002',
      description:
        'Barbershop moderne à Bab Ezzouar. Spécialisé dans les coupes tendance, dégradés américains et soins de la barbe.',
      addressLine: '12 rue des Frères Bouadou',
      district: 'Bab Ezzouar',
      city: 'Alger',
      latitude: 36.722,
      longitude: 3.183,
      openingHours: {
        monday: { open: '09:00', close: '20:00' },
        tuesday: { open: '09:00', close: '20:00' },
        wednesday: { open: '09:00', close: '20:00' },
        thursday: { open: '09:00', close: '20:00' },
        friday: null, // Fermé le vendredi
        saturday: { open: '09:00', close: '22:00' },
        sunday: { open: '10:00', close: '18:00' },
      },
      photos: [],
      isActive: true,
      ownerId: karim.id,
    },
  });
  console.log(`✅ Salon créé : ${salon.name} (mawid.dz/${salon.slug})`);

  // ---- 3. Prestations ----
  const prestations = [
    {
      name: 'Coupe Homme',
      description: 'Coupe classique aux ciseaux',
      durationMinutes: 30,
      priceCents: 80000, // 800 DZD
      displayOrder: 1,
    },
    {
      name: 'Dégradé Américain',
      description: 'Dégradé fade précis à la tondeuse',
      durationMinutes: 45,
      priceCents: 120000, // 1200 DZD
      displayOrder: 2,
    },
    {
      name: 'Barbe',
      description: 'Taille et soin complet de la barbe',
      durationMinutes: 20,
      priceCents: 50000, // 500 DZD
      displayOrder: 3,
    },
    {
      name: 'Coupe + Barbe',
      description: 'Combo coupe homme et soin de barbe',
      durationMinutes: 50,
      priceCents: 120000, // 1200 DZD
      displayOrder: 4,
    },
    {
      name: 'Coupe Enfant (-12 ans)',
      description: 'Coupe pour les plus jeunes',
      durationMinutes: 25,
      priceCents: 60000, // 600 DZD
      displayOrder: 5,
    },
  ];

  for (const p of prestations) {
    // upsert basé sur (salonId + name) — pas de @@unique en V1, on simule via findFirst
    const existing = await prisma.prestation.findFirst({
      where: { salonId: salon.id, name: p.name },
    });

    if (existing) {
      await prisma.prestation.update({
        where: { id: existing.id },
        data: p,
      });
    } else {
      await prisma.prestation.create({
        data: { ...p, salonId: salon.id },
      });
    }
  }
  console.log(`✅ ${prestations.length} prestations créées pour ${salon.name}`);

  // ---- Récap ----
  const userCount = await prisma.user.count();
  const salonCount = await prisma.salon.count();
  const prestationCount = await prisma.prestation.count();

  console.log('\n📊 État de la base après seed :');
  console.log(`   Users:       ${userCount}`);
  console.log(`   Salons:      ${salonCount}`);
  console.log(`   Prestations: ${prestationCount}`);
  console.log('\n🎉 Seed terminé avec succès !');
  console.log(`   Karim peut se connecter avec : ${karimPhone} / karim1234`);
  console.log(`   Page publique salon : http://localhost:3000/${salon.slug}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur durant le seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });