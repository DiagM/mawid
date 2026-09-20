import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

/** Réservation telle que la renvoie Prisma pour l'agrégation des fiches. */
function reservation(
  clientId: string,
  firstName: string,
  status: string,
  daysFromNow: number,
  priceCents = 80000,
) {
  return {
    clientId,
    clientFirstName: firstName,
    clientPhone: `+21355500000${clientId.slice(-1)}`,
    startsAt: new Date(Date.now() + daysFromNow * DAY),
    status,
    client: { isBlocked: false },
    reservationPrestations: [{ priceCentsSnapshot: priceCents }],
  };
}

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    reservation: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salon: { findFirst: jest.fn().mockResolvedValue({ id: 'salon-a' }) },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ClientsService);
  });

  describe('agrégation des fiches', () => {
    it('cumule visites, absences et dépenses par client', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        reservation('cli-1', 'Amine', 'HONORED', -5, 80000),
        reservation('cli-1', 'Amine', 'HONORED', -40, 50000),
        reservation('cli-1', 'Amine', 'NO_SHOW', -20),
        reservation('cli-1', 'Amine', 'CANCELED', -10),
      ]);

      const result = await service.findMine('user-a');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        visits: 2,
        noShows: 1,
        canceled: 1,
        totalSpentCents: 130000,
      });
    });

    it('ne compte dans les dépenses que les visites honorées', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        reservation('cli-1', 'Amine', 'NO_SHOW', -5, 90000),
        reservation('cli-1', 'Amine', 'CANCELED', -6, 90000),
      ]);

      const result = await service.findMine('user-a');

      expect(result.items[0].totalSpentCents).toBe(0);
      expect(result.items[0].lastVisit).toBeNull();
    });
  });

  describe('segments pour les campagnes', () => {
    const LAPSED = reservation('cli-1', 'Perdu', 'HONORED', -90);
    const RECENT = reservation('cli-2', 'Recent', 'HONORED', -5);

    it('« perdus de vue » : visite ancienne et aucun RDV à venir', async () => {
      prisma.reservation.findMany.mockResolvedValue([LAPSED, RECENT]);

      const result = await service.findMine('user-a', undefined, 100, 'lapsed');

      expect(result.items.map((client) => client.firstName)).toEqual(['Perdu']);
    });

    it('exclut ceux qui ont déjà un rendez-vous à venir', async () => {
      // Les relancer serait à côté de la plaque : ils reviennent déjà.
      prisma.reservation.findMany.mockResolvedValue([
        LAPSED,
        reservation('cli-1', 'Perdu', 'CONFIRMED', 3),
      ]);

      const result = await service.findMine('user-a', undefined, 100, 'lapsed');

      expect(result.items).toHaveLength(0);
    });

    it('exclut ceux qui ne sont jamais venus', async () => {
      // Un client sans visite honorée n'est pas « perdu de vue ».
      prisma.reservation.findMany.mockResolvedValue([
        reservation('cli-3', 'Jamais', 'NO_SHOW', -100),
      ]);

      const result = await service.findMine('user-a', undefined, 100, 'lapsed');

      expect(result.items).toHaveLength(0);
    });

    it('respecte le seuil d’ancienneté demandé', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        reservation('cli-4', 'Trente', 'HONORED', -30),
      ]);

      const large = await service.findMine(
        'user-a',
        undefined,
        100,
        'lapsed',
        20,
      );
      const strict = await service.findMine(
        'user-a',
        undefined,
        100,
        'lapsed',
        60,
      );

      expect(large.items).toHaveLength(1);
      expect(strict.items).toHaveLength(0);
    });

    it('« fidèles » : au moins trois visites', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        reservation('cli-1', 'Fidele', 'HONORED', -5),
        reservation('cli-1', 'Fidele', 'HONORED', -20),
        reservation('cli-1', 'Fidele', 'HONORED', -40),
        reservation('cli-2', 'Occasionnel', 'HONORED', -5),
      ]);

      const result = await service.findMine(
        'user-a',
        undefined,
        100,
        'regulars',
      );

      expect(result.items.map((client) => client.firstName)).toEqual([
        'Fidele',
      ]);
    });

    it('le total reflète le segment, pas la base entière', async () => {
      // Afficher « 50 destinataires » pour un segment qui en contient 3
      // ferait envoyer une campagne à côté de la cible.
      prisma.reservation.findMany.mockResolvedValue([LAPSED, RECENT]);

      const result = await service.findMine('user-a', undefined, 100, 'lapsed');

      expect(result.total).toBe(1);
    });
  });

  describe('isolation entre salons', () => {
    it('scope par ownerId, jamais par un identifiant fourni', async () => {
      await service.findMine('user-a');

      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-a' } }),
      );
      const calls = prisma.reservation.findMany.mock.calls as {
        where: { salonId: string };
      }[][];
      expect(calls[0][0].where.salonId).toBe('salon-a');
    });

    it('refuse une fiche sans aucun rendez-vous dans ce salon', async () => {
      // C'est ce qui empêche un gérant de lire la fiche d'un client d'un
      // autre salon en devinant son identifiant.
      prisma.reservation.findMany.mockResolvedValue([]);

      await expect(
        service.findOne('user-a', 'cli-du-salon-b'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un gérant sans salon', async () => {
      prisma.salon.findFirst.mockResolvedValue(null);

      await expect(service.findMine('sans-salon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
