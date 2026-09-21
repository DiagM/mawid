import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { toE164 } from '../common/phone';
import {
  CreateTicketDto,
  TicketsQueryDto,
  UpdateTicketDto,
} from './dto/support.dto';

/** Libellés lisibles dans l'e-mail de notification. */
const KIND_LABELS = {
  UPGRADE: 'Changement d’offre',
  ISSUE: 'Problème signalé',
  OTHER: 'Autre demande',
} as const;

/**
 * ============================================
 * Demandes adressées à Mawid
 * ============================================
 * Deux portes d'entrée, un seul traitement : un gérant connecté depuis son
 * back-office, et n'importe qui depuis la page contact publique — un salon
 * pas encore inscrit doit pouvoir écrire, c'est un canal d'acquisition.
 *
 * **Le ticket est la source de vérité, pas l'e-mail.** Un e-mail se perd
 * dans une boîte ; une file avec un statut ne se perd pas. L'envoi n'est
 * qu'une notification, et son échec ne fait jamais échouer la demande.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Enregistre une demande.
   *
   * @param userId renseigné seulement quand l'auteur est connecté. Le salon
   * est alors retrouvé par `ownerId` — jamais accepté depuis la requête.
   */
  async create(dto: CreateTicketDto, userId?: string) {
    const salon = userId ? await this.findSalonOf(userId) : null;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        kind: dto.kind,
        subject: dto.subject,
        message: dto.message,
        contactName: dto.contactName,
        contactPhone: toE164(dto.contactPhone),
        contactEmail: dto.contactEmail ?? null,
        // Une offre demandée n'a de sens que pour un changement d'offre :
        // la garder ailleurs laisserait croire à une demande qui n'existe pas.
        requestedPlan:
          dto.kind === 'UPGRADE' ? (dto.requestedPlan ?? null) : null,
        userId: userId ?? null,
        salonId: salon?.id ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // Volontairement attendu mais jamais fatal : `notify` n'échoue pas.
    await this.mailer.notify(
      `[Mawid] ${KIND_LABELS[dto.kind]} — ${dto.subject}`,
      [
        `Type    : ${KIND_LABELS[dto.kind]}`,
        `Sujet   : ${dto.subject}`,
        `Contact : ${dto.contactName} — ${toE164(dto.contactPhone)}`,
        ...(dto.contactEmail ? [`E-mail  : ${dto.contactEmail}`] : []),
        ...(salon
          ? [`Salon   : ${salon.name} (/${salon.slug}, offre ${salon.plan})`]
          : ['Salon   : non inscrit ou non connecté']),
        ...(dto.kind === 'UPGRADE' && dto.requestedPlan
          ? [`Demande : passage à l’offre ${dto.requestedPlan}`]
          : []),
        '',
        dto.message,
        '',
        `Ticket ${ticket.id} — à traiter dans /admin/demandes`,
      ],
    );

    return {
      id: ticket.id,
      createdAt: ticket.createdAt.toISOString(),
    };
  }

  // ============================================
  // Console d'administration
  // ============================================

  /** File de traitement : les demandes ouvertes d'abord. */
  async findAll(query: TicketsQueryDto) {
    const status = query.status ?? 'OPEN';

    const tickets = await this.prisma.supportTicket.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        kind: true,
        status: true,
        subject: true,
        message: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        requestedPlan: true,
        internalNote: true,
        createdAt: true,
        closedAt: true,
        salon: { select: { slug: true, name: true, plan: true } },
      },
    });

    return tickets.map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt.toISOString(),
      closedAt: ticket.closedAt?.toISOString() ?? null,
    }));
  }

  /** Nombre de demandes ouvertes, pour la pastille de la console. */
  async openCount(): Promise<number> {
    return this.prisma.supportTicket.count({ where: { status: 'OPEN' } });
  }

  async update(ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException('Demande introuvable');
    }

    const closing = dto.status === 'CLOSED' && ticket.status !== 'CLOSED';
    const reopening = dto.status !== undefined && dto.status !== 'CLOSED';

    return this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.internalNote !== undefined && {
          internalNote: dto.internalNote || null,
        }),
        // La date de clôture suit le statut : une demande rouverte ne doit
        // pas garder une date qui laisserait croire qu'elle est réglée.
        ...(closing && { closedAt: new Date() }),
        ...(reopening && { closedAt: null }),
      },
      select: { id: true, status: true, closedAt: true },
    });
  }

  private async findSalonOf(userId: string) {
    // `findFirst` et non `findUniqueOrThrow` : un administrateur peut écrire
    // sans posséder de salon, et ce n'est pas une erreur.
    return this.prisma.salon.findFirst({
      where: { ownerId: userId },
      select: { id: true, slug: true, name: true, plan: true },
    });
  }
}
