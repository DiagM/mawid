import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Horaires volontairement identiques sur les 7 jours : le but de ces tests est
 * la grille de créneaux, pas le calendrier. Un salon fermé certains jours est
 * couvert par un test dédié.
 */
const ALWAYS_OPEN = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { open: '09:00', close: '17:00' },
  sunday: { open: '09:00', close: '17:00' },
};

const SALON_A = 'salon-a';
const DATE = '2026-10-05';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}
// Bien avant l'ouverture : le délai minimum ne doit filtrer aucun créneau.
const NOW = new Date('2026-10-04T06:00:00.000Z');

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    salon: { findUnique: jest.Mock };
    prestation: { findMany: jest.Mock };
    employee: { findMany: jest.Mock };
    reservation: { findMany: jest.Mock };
    blockedSlot: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salon: {
        findUnique: jest.fn().mockResolvedValue({
          id: SALON_A,
          isActive: true,
          openingHours: ALWAYS_OPEN,
        }),
      },
      prestation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p-coupe',
            name: 'Coupe',
            durationMinutes: 30,
            priceCents: 80000,
          },
        ]),
      },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
      reservation: { findMany: jest.fn().mockResolvedValue([]) },
      blockedSlot: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AvailabilityService);
  });

  const times = async (): Promise<string[]> => {
    const result = await service.getAvailability(
      'salon-a',
      DATE,
      ['p-coupe'],
      NOW,
    );
    return result.slots.map((slot) => slot.localTime);
  };

  describe('grille de créneaux', () => {
    it('propose des créneaux de 09:00 au dernier permettant de finir avant la fermeture', async () => {
      const slots = await times();
      expect(slots[0]).toBe('09:00');
      expect(slots[1]).toBe('09:15');
      // 16:30 + 30 min = 17:00 pile : le dernier créneau tenable.
      expect(slots[slots.length - 1]).toBe('16:30');
    });

    it("renvoie des instants UTC, décalés d'une heure par rapport au local", async () => {
      const result = await service.getAvailability(
        'salon-a',
        DATE,
        ['p-coupe'],
        NOW,
      );
      expect(result.slots[0]).toEqual({
        startsAt: '2026-10-05T08:00:00.000Z',
        localTime: '09:00',
      });
    });

    it('ne propose aucun créneau un jour de fermeture', async () => {
      prisma.salon.findUnique.mockResolvedValue({
        id: SALON_A,
        isActive: true,
        openingHours: { ...ALWAYS_OPEN, monday: null },
      });
      expect(await times()).toEqual([]);
    });
  });

  describe('créneaux déjà occupés', () => {
    it('retire les créneaux qui chevauchent une réservation confirmée', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T09:00:00.000Z'), // 10:00 locale
          endsAt: new Date('2026-10-05T09:30:00.000Z'), // 10:30 locale
          employeeId: null,
        },
      ]);

      const slots = await times();
      // Un créneau qui démarre à 09:45 finirait à 10:15 : il mord dessus.
      expect(slots).not.toContain('09:45');
      expect(slots).not.toContain('10:00');
      expect(slots).not.toContain('10:15');
      // 09:30-10:00 et 10:30-11:00 sont adjacents, donc libres.
      expect(slots).toContain('09:30');
      expect(slots).toContain('10:30');
    });

    it('retire aussi les créneaux couverts par un créneau bloqué', async () => {
      prisma.blockedSlot.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T11:00:00.000Z'), // 12:00 locale
          endsAt: new Date('2026-10-05T12:00:00.000Z'), // 13:00 locale
          employeeId: null,
        },
      ]);

      const slots = await times();
      expect(slots).not.toContain('12:00');
      expect(slots).not.toContain('12:30');
      expect(slots).toContain('13:00');
    });
  });

  describe('règles de réservation', () => {
    it('masque les créneaux trop proches (délai minimum)', async () => {
      // 09:20 locale le jour même : les créneaux avant 10:20 sont hors délai.
      const now = new Date('2026-10-05T08:20:00.000Z');
      const result = await service.getAvailability(
        'salon-a',
        DATE,
        ['p-coupe'],
        now,
      );
      const slots = result.slots.map((slot) => slot.localTime);
      expect(slots).not.toContain('09:30');
      expect(slots).not.toContain('10:15');
      expect(slots[0]).toBe('10:30');
    });

    it('refuse une date passée', async () => {
      await expect(
        service.getAvailability('salon-a', '2026-10-01', ['p-coupe'], NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuse une date au-delà de l'horizon", async () => {
      await expect(
        service.getAvailability('salon-a', '2026-11-30', ['p-coupe'], NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse une sélection dépassant la durée maximale', async () => {
      prisma.prestation.findMany.mockResolvedValue([
        {
          id: 'p-long',
          name: 'Journée',
          durationMinutes: 240,
          priceCents: 100,
        },
      ]);
      await expect(
        service.getAvailability('salon-a', DATE, ['p-long'], NOW),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('isolation entre salons', () => {
    it("refuse une prestation qui n'appartient pas au salon", async () => {
      // La prestation du salon B n'est pas retrouvée par le filtre salonId :
      // on doit refuser, surtout pas ignorer silencieusement l'identifiant.
      prisma.prestation.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailability('salon-a', DATE, ['p-du-salon-b'], NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse une sélection partiellement valide', async () => {
      prisma.prestation.findMany.mockResolvedValue([
        {
          id: 'p-coupe',
          name: 'Coupe',
          durationMinutes: 30,
          priceCents: 80000,
        },
      ]);

      await expect(
        service.getAvailability(
          'salon-a',
          DATE,
          ['p-coupe', 'p-du-salon-b'],
          NOW,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ne charge que les réservations du salon demandé', async () => {
      await times();
      const query = firstArg<{ where: { salonId: string } }>(
        prisma.reservation.findMany,
      );
      expect(query.where.salonId).toBe(SALON_A);
    });

    it('refuse un salon désactivé', async () => {
      prisma.salon.findUnique.mockResolvedValue({
        id: SALON_A,
        isActive: false,
        openingHours: ALWAYS_OPEN,
      });
      await expect(
        service.getAvailability('salon-a', DATE, ['p-coupe'], NOW),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('multi-employés (V2)', () => {
    const TEAM = [
      { id: 'emp-1', workingHours: null },
      { id: 'emp-2', workingHours: null },
    ];

    it('propose un créneau tant qu’un membre au moins est libre', async () => {
      prisma.employee.findMany.mockResolvedValue(TEAM);
      // emp-1 occupé de 10:00 à 10:30 locale ; emp-2 libre.
      prisma.reservation.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T09:00:00.000Z'),
          endsAt: new Date('2026-10-05T09:30:00.000Z'),
          employeeId: 'emp-1',
        },
      ]);

      expect(await times()).toContain('10:00');
    });

    it('retire le créneau quand TOUS les membres sont pris', async () => {
      prisma.employee.findMany.mockResolvedValue(TEAM);
      prisma.reservation.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T09:00:00.000Z'),
          endsAt: new Date('2026-10-05T09:30:00.000Z'),
          employeeId: 'emp-1',
        },
        {
          startsAt: new Date('2026-10-05T09:00:00.000Z'),
          endsAt: new Date('2026-10-05T09:30:00.000Z'),
          employeeId: 'emp-2',
        },
      ]);

      expect(await times()).not.toContain('10:00');
    });

    it('restreint au membre demandé par le client', async () => {
      prisma.employee.findMany.mockResolvedValue([TEAM[0]]);

      await service.getAvailability('salon-a', DATE, ['p-coupe'], NOW, 'emp-1');

      const query = firstArg<{
        where: { salonId: string; isActive: boolean; id?: string };
      }>(prisma.employee.findMany);
      expect(query.where.id).toBe('emp-1');
      // Le filtre salonId reste appliqué : un identifiant appartenant à un
      // autre salon ne doit pas exposer ses disponibilités.
      expect(query.where.salonId).toBe(SALON_A);
    });

    it('refuse un membre introuvable plutôt que de retomber sur le salon', async () => {
      // Retomber sur la ressource implicite proposerait des créneaux au nom
      // de quelqu'un qui n'existe pas dans ce salon.
      prisma.employee.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailability('salon-a', DATE, ['p-coupe'], NOW, 'emp-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ignore les blocages visant un autre membre', async () => {
      prisma.employee.findMany.mockResolvedValue([TEAM[0]]);
      prisma.blockedSlot.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T11:00:00.000Z'),
          endsAt: new Date('2026-10-05T12:00:00.000Z'),
          employeeId: 'emp-2',
        },
      ]);

      expect(await times()).toContain('12:00');
    });

    it('applique un blocage visant tout le salon à chaque membre', async () => {
      prisma.employee.findMany.mockResolvedValue(TEAM);
      prisma.blockedSlot.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T11:00:00.000Z'),
          endsAt: new Date('2026-10-05T12:00:00.000Z'),
          employeeId: null,
        },
      ]);

      expect(await times()).not.toContain('12:00');
    });
  });

  describe('resolveResourceForSlot', () => {
    const context = {
      salonId: SALON_A,
      openingHours: ALWAYS_OPEN,
      prestations: [
        {
          id: 'p-coupe',
          name: 'Coupe',
          durationMinutes: 30,
          priceCents: 80000,
        },
      ],
      totalDurationMinutes: 30,
    };

    it('accepte un créneau valide et renvoie la ressource implicite', async () => {
      const resource = await service.resolveResourceForSlot(
        context,
        new Date('2026-10-05T08:00:00.000Z'),
        NOW,
      );
      expect(resource).toBeNull();
    });

    it('refuse un créneau hors grille', async () => {
      await expect(
        service.resolveResourceForSlot(
          context,
          new Date('2026-10-05T08:07:00.000Z'),
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("refuse un créneau hors des horaires d'ouverture", async () => {
      await expect(
        service.resolveResourceForSlot(
          context,
          new Date('2026-10-05T18:00:00.000Z'), // 19:00 locale
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un créneau qui déborderait après la fermeture', async () => {
      await expect(
        service.resolveResourceForSlot(
          context,
          new Date('2026-10-05T15:45:00.000Z'), // 16:45 + 30 min = 17:15
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuse un créneau déjà pris', async () => {
      prisma.reservation.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-10-05T08:00:00.000Z'),
          endsAt: new Date('2026-10-05T08:30:00.000Z'),
          employeeId: null,
        },
      ]);

      await expect(
        service.resolveResourceForSlot(
          context,
          new Date('2026-10-05T08:00:00.000Z'),
          NOW,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
