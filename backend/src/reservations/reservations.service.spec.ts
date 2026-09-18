import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

const SALON_A = 'salon-a';
const SALON_B = 'salon-b';
const GERANT_A = 'user-a';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

/**
 * Il n'y a pas de Row Level Security en base : l'isolation entre salons tient
 * entièrement au code de ce service. Ces tests sont donc la seule preuve
 * automatisée qu'un gérant ne peut pas toucher aux données d'un autre salon.
 */
describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: {
    salon: { findFirst: jest.Mock };
    reservation: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    client: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let availability: {
    resolveContext: jest.Mock;
    resolveResourceForSlot: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      // Le gérant A ne possède que le salon A.
      salon: { findFirst: jest.fn().mockResolvedValue({ id: SALON_A }) },
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        // Quotas par numéro : aucun RDV existant par défaut.
        count: jest.fn().mockResolvedValue(0),
      },
      client: {
        upsert: jest.fn().mockResolvedValue({ id: 'cli-1', isBlocked: false }),
      },
      $transaction: jest.fn(),
    };

    availability = {
      resolveContext: jest.fn().mockResolvedValue({
        salonId: SALON_A,
        openingHours: {},
        prestations: [
          {
            id: 'p-coupe',
            name: 'Coupe',
            durationMinutes: 30,
            priceCents: 80000,
          },
        ],
        totalDurationMinutes: 30,
      }),
      resolveResourceForSlot: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AvailabilityService, useValue: availability },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
  });

  describe('isolation entre salons (pas de RLS, tout tient à ce code)', () => {
    it("n'expose que les réservations du salon dont le gérant est propriétaire", async () => {
      await service.findMine(GERANT_A, '2026-10-05', '2026-10-05');

      // Le salon est retrouvé par ownerId, jamais par un id fourni en entrée.
      expect(prisma.salon.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: GERANT_A } }),
      );
      const query = firstArg<{ where: { salonId: string } }>(
        prisma.reservation.findMany,
      );
      expect(query.where.salonId).toBe(SALON_A);
    });

    it('refuse au gérant A de modifier une réservation du salon B', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-du-salon-b',
        salonId: SALON_B,
        status: 'CONFIRMED',
      });

      await expect(
        service.updateStatus(GERANT_A, 'res-du-salon-b', { status: 'HONORED' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Rien ne doit avoir été écrit.
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('autorise le gérant sur une réservation de son propre salon', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        salonId: SALON_A,
        status: 'CONFIRMED',
      });

      await service.updateStatus(GERANT_A, 'res-1', { status: 'HONORED' });

      const write = firstArg<{
        where: { id: string };
        data: { status: string };
      }>(prisma.reservation.update);
      expect(write.where.id).toBe('res-1');
      expect(write.data.status).toBe('HONORED');
    });

    it('refuse un gérant sans salon plutôt que de tout lui montrer', async () => {
      prisma.salon.findFirst.mockResolvedValue(null);

      await expect(service.findMine('user-sans-salon')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('création', () => {
    const dto = {
      startsAt: '2026-10-05T08:00:00.000Z',
      prestationIds: ['p-coupe'],
      clientFirstName: 'Amine',
      clientPhone: '+213555987654',
    };

    it('recalcule durée et prix depuis la base, sans rien croire du client', async () => {
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          reservation: {
            create: jest.fn().mockResolvedValue({
              id: 'res-1',
              startsAt: new Date('2026-10-05T08:00:00.000Z'),
              endsAt: new Date('2026-10-05T08:30:00.000Z'),
              status: 'CONFIRMED',
              cancellationToken: 'tok-1',
              clientFirstName: 'Amine',
              reservationPrestations: [
                {
                  nameSnapshot: 'Coupe',
                  priceCentsSnapshot: 80000,
                  durationMinutesSnapshot: 30,
                },
              ],
            }),
          },
        }),
      );

      const result = await service.createForSalon('salon-a', dto);

      expect(result.totalPriceCents).toBe(80000);
      expect(result.localTime).toBe('09:00');
      // Le token n'est renvoyé qu'ici : c'est le lien de gestion du client.
      expect(result).toHaveProperty('cancellationToken', 'tok-1');
    });

    it('traduit une collision de la contrainte base en 409, pas en 500', async () => {
      // Ce que remonte pg quand deux réservations visent le même créneau.
      const pgError = Object.assign(new Error('conflicting key value'), {
        code: '23P01',
      });
      prisma.$transaction.mockRejectedValue(pgError);

      await expect(
        service.createForSalon('salon-a', dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("laisse remonter une erreur qui n'est pas un conflit de créneau", async () => {
      prisma.$transaction.mockRejectedValue(new Error('base injoignable'));

      await expect(service.createForSalon('salon-a', dto)).rejects.toThrow(
        'base injoignable',
      );
    });

    it('refuse un 4e RDV à venir dans le même salon', async () => {
      // Saturer un agenda demande beaucoup de réservations : ce plafond rend
      // l'attaque impossible sans changer de numéro à chaque fois.
      prisma.reservation.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      await expect(
        service.createForSalon('salon-a', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuse au-delà de 5 réservations en 24 h pour un même numéro', async () => {
      prisma.reservation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);

      await expect(
        service.createForSalon('salon-a', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('compte les RDV à venir du bon numéro ET du bon salon', async () => {
      prisma.$transaction.mockResolvedValue({
        id: 'res-1',
        startsAt: new Date('2026-10-05T08:00:00.000Z'),
        endsAt: new Date('2026-10-05T08:30:00.000Z'),
        status: 'CONFIRMED',
        cancellationToken: 'tok-1',
        clientFirstName: 'Amine',
        reservationPrestations: [],
      });

      await service.createForSalon('salon-a', dto);

      const quota = firstArg<{
        where: { clientId: string; salonId: string; status: string };
      }>(prisma.reservation.count);
      expect(quota.where.clientId).toBe('cli-1');
      expect(quota.where.salonId).toBe(SALON_A);
      expect(quota.where.status).toBe('CONFIRMED');
    });

    it('refuse un client bloqué sans lui dire pourquoi', async () => {
      prisma.client.upsert.mockResolvedValue({
        id: 'cli-2',
        isBlocked: true,
      });

      await expect(
        service.createForSalon('salon-a', dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('annulation par token', () => {
    it('annule un RDV confirmé à venir', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        status: 'CONFIRMED',
        startsAt: new Date(Date.now() + 86_400_000),
      });

      await expect(service.cancelByToken('tok-1')).resolves.toEqual({
        status: 'CANCELED',
      });
    });

    it('refuse un token inconnu', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.cancelByToken('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuse un RDV déjà passé', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        status: 'CONFIRMED',
        startsAt: new Date(Date.now() - 3_600_000),
      });

      await expect(service.cancelByToken('tok-1')).rejects.toThrow(
        'Ce rendez-vous est passé. Contactez le salon.',
      );
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });
  });

  describe('lecture par token', () => {
    it("n'expose ni le token ni la note interne", async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        startsAt: new Date('2026-10-05T08:00:00.000Z'),
        endsAt: new Date('2026-10-05T08:30:00.000Z'),
        status: 'CONFIRMED',
        cancellationToken: 'tok-1',
        clientFirstName: 'Amine',
        internalNote: 'Client difficile',
        reservationPrestations: [
          {
            nameSnapshot: 'Coupe',
            priceCentsSnapshot: 80000,
            durationMinutesSnapshot: 30,
          },
        ],
        salon: {
          name: 'Karim Barber',
          slug: 'karim-barber',
          contactPhone: '+213555100002',
        },
      });

      const view = await service.findByToken('tok-1');

      expect(view).not.toHaveProperty('cancellationToken');
      expect(view).not.toHaveProperty('internalNote');
      expect(view).toHaveProperty('salon');
    });
  });
});
