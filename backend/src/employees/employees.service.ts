import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// Import de valeur et non `import type` : `Prisma.DbNull` existe au runtime,
// c'est lui qui distingue « colonne NULL » d'une valeur JSON `null`.
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Équipe du salon du gérant connecté, actifs et archivés. */
  async findMine(userId: string) {
    const salon = await this.getOwnedSalon(userId);

    return this.prisma.employee.findMany({
      where: { salonId: salon.id },
      orderBy: [{ isActive: 'desc' }, { displayOrder: 'asc' }],
    });
  }

  /**
   * Ajoute un membre à l'équipe.
   *
   * **Le cas du premier employé est particulier.** Jusque-là, les réservations
   * du salon portent `employeeId = null`, ce qui signifie « la ressource
   * unique du salon ». Dès qu'un employé existe, le moteur de disponibilité
   * raisonne par employé : laisser d'anciens rendez-vous non assignés créerait
   * un état mixte où la contrainte d'exclusion — qui porte sur
   * `COALESCE(employeeId, salonId)` — ne verrait pas le conflit entre un RDV
   * non assigné et un RDV du nouvel employé. Deux clients pourraient alors se
   * présenter au même moment.
   *
   * On réassigne donc les rendez-vous à venir au premier employé créé. C'est
   * aussi le comportement attendu : ces RDV étaient ceux du gérant, qui est le
   * plus souvent ce premier membre de l'équipe.
   */
  async create(userId: string, dto: CreateEmployeeDto) {
    const salon = await this.getOwnedSalon(userId);

    const existingCount = await this.prisma.employee.count({
      where: { salonId: salon.id },
    });

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          salonId: salon.id,
          fullName: dto.fullName,
          displayOrder: dto.displayOrder ?? existingCount,
          workingHours: this.toJsonInput(dto.workingHours),
        },
      });

      if (existingCount === 0) {
        // Les RDV passés gardent `null` : réécrire l'historique fausserait
        // les futures statistiques par employé, qui ne sauraient rien de ces
        // rendez-vous antérieurs à l'existence de l'équipe.
        await tx.reservation.updateMany({
          where: {
            salonId: salon.id,
            employeeId: null,
            status: 'CONFIRMED',
            startsAt: { gt: new Date() },
          },
          data: { employeeId: employee.id },
        });
      }

      return employee;
    });
  }

  async update(userId: string, employeeId: string, dto: UpdateEmployeeDto) {
    const employee = await this.assertOwnership(userId, employeeId);

    const data: Prisma.EmployeeUpdateInput = {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.displayOrder !== undefined && {
        displayOrder: dto.displayOrder,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.workingHours !== undefined && {
        workingHours: this.toJsonInput(dto.workingHours),
      }),
    };

    return this.prisma.employee.update({
      where: { id: employee.id },
      data,
    });
  }

  /**
   * Archive un membre de l'équipe.
   *
   * Pas de suppression : `Reservation.employeeId` est en `onDelete: Restrict`,
   * et surtout un employé parti garde un historique de rendez-vous qui doit
   * rester lisible. On refuse en revanche d'archiver quelqu'un qui a encore
   * des rendez-vous à venir — ces clients se présenteraient face à personne.
   */
  async archive(userId: string, employeeId: string) {
    const employee = await this.assertOwnership(userId, employeeId);

    const upcoming = await this.prisma.reservation.count({
      where: {
        employeeId: employee.id,
        status: 'CONFIRMED',
        startsAt: { gt: new Date() },
      },
    });

    if (upcoming > 0) {
      throw new BadRequestException(
        `${upcoming} rendez-vous à venir sont assignés à cette personne. ` +
          'Annulez-les ou attendez qu’ils soient passés avant de l’archiver.',
      );
    }

    return this.prisma.employee.update({
      where: { id: employee.id },
      data: { isActive: false },
    });
  }

  // ============================================
  // Helpers privés
  // ============================================

  private async getOwnedSalon(userId: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!salon) {
      throw new NotFoundException("Aucun salon n'est associé à votre compte");
    }

    return salon;
  }

  private async assertOwnership(userId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, salon: { select: { ownerId: true } } },
    });

    if (!employee) {
      throw new NotFoundException('Membre introuvable');
    }

    if (employee.salon.ownerId !== userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce membre");
    }

    return employee;
  }

  /**
   * `workingHours` est un champ Json : Prisma distingue `null` (valeur JSON
   * nulle) de `Prisma.DbNull` (colonne NULL). C'est bien la colonne NULL qu'on
   * veut quand l'employé suit les horaires du salon.
   */
  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
    if (value === null || value === undefined) {
      return Prisma.DbNull;
    }
    return value;
  }
}
