import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Premier argument du premier appel d'un mock, typé explicitement.
 * `jest.Mock` expose `mock.calls` en `any` : on repasse par `unknown` pour que
 * l'assertion reste typée au lieu de désactiver la règle ESLint.
 */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

interface SalonCreate {
  data: {
    slug: string;
    isActive: boolean;
    contactPhone: string;
    ownerId: string;
    openingHours: Record<string, unknown>;
  };
}

interface UserCreate {
  data: {
    phone: string;
    role: string;
    mustChangePassword: boolean;
    passwordHash: string;
  };
}

describe('AuthService — inscription self-service', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    salon: { findUnique: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let userCreate: jest.Mock;
  let salonCreate: jest.Mock;

  const validDto = {
    phone: '0555123456',
    fullName: 'Yacine Ould',
    password: 'motdepasse1',
    salonName: 'Salon Élégance',
    addressLine: '10 rue Didouche Mourad',
    district: 'Alger-Centre',
    contactPhone: '0555123457',
  };

  beforeEach(async () => {
    userCreate = jest.fn().mockResolvedValue({
      id: 'user-1',
      phone: '+213555123456',
      fullName: 'Yacine Ould',
      role: 'MANAGER',
      mustChangePassword: false,
    });
    salonCreate = jest.fn().mockResolvedValue({ id: 'salon-1' });

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: userCreate,
        update: jest.fn(),
      },
      salon: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: salonCreate,
      },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ user: { create: userCreate }, salon: { create: salonCreate } }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('crée le salon INACTIF, en attente de validation', async () => {
    await service.register(validDto);

    const create = firstArg<SalonCreate>(salonCreate);
    // C'est ce qui rend l'ouverture de la route acceptable sans vérification
    // d'identité : un faux salon n'atteint aucun client.
    expect(create.data.isActive).toBe(false);
  });

  it('normalise les deux numéros en E.164', async () => {
    await service.register(validDto);

    const user = firstArg<UserCreate>(userCreate);
    const salon = firstArg<SalonCreate>(salonCreate);
    expect(user.data.phone).toBe('+213555123456');
    expect(salon.data.contactPhone).toBe('+213555123457');
  });

  it('génère un slug lisible depuis le nom du salon', async () => {
    await service.register(validDto);

    const create = firstArg<SalonCreate>(salonCreate);
    // Les accents sont translittérés, pas échappés : ce slug est imprimé sur
    // des cartes et partagé sur WhatsApp.
    expect(create.data.slug).toBe('salon-elegance');
  });

  it('suffixe le slug quand il est déjà pris', async () => {
    prisma.salon.findUnique
      .mockResolvedValueOnce({ id: 'autre' })
      .mockResolvedValueOnce(null);

    await service.register(validDto);

    const create = firstArg<SalonCreate>(salonCreate);
    expect(create.data.slug).toBe('salon-elegance-2');
  });

  it('crée un MANAGER, jamais un ADMIN', async () => {
    await service.register(validDto);

    const create = firstArg<UserCreate>(userCreate);
    expect(create.data.role).toBe('MANAGER');
  });

  it("n'impose pas de changement de mot de passe", async () => {
    // Le gérant a choisi son mot de passe lui-même, contrairement aux comptes
    // créés par le script d'onboarding manuel.
    await service.register(validDto);

    const create = firstArg<UserCreate>(userCreate);
    expect(create.data.mustChangePassword).toBe(false);
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    await service.register(validDto);

    const create = firstArg<UserCreate>(userCreate);
    expect(create.data.passwordHash).not.toBe(validDto.password);
    expect(create.data.passwordHash.startsWith('$2')).toBe(true);
  });

  it('donne des horaires par défaut exploitables', async () => {
    // Un salon sans horaires ne proposerait aucun créneau et paraîtrait cassé.
    await service.register(validDto);

    const create = firstArg<SalonCreate>(salonCreate);
    expect(create.data.openingHours.monday).toEqual({
      open: '09:00',
      close: '19:00',
    });
    expect(create.data.openingHours.friday).toBeNull();
  });

  it('refuse un numéro déjà inscrit sans le confirmer', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'deja' });

    const promise = service.register(validDto);

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    // Le message ne doit pas confirmer l'existence du compte : sinon la route
    // devient un oracle permettant d'énumérer les gérants inscrits.
    await expect(promise).rejects.toThrow(/Inscription impossible/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
