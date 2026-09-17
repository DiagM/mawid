import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './types/jwt-payload.type';

/**
 * Coût bcrypt. 12 plutôt que 10 : le login est désormais limité à 5 essais
 * par quart d'heure, le surcoût de calcul est donc invisible à l'usage, mais
 * il rend une attaque hors ligne sur une base volée nettement plus chère.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Informations utilisateur renvoyées au client lors d'un login.
 * Exporté pour pouvoir typer la signature du controller.
 */
export interface PublicUser {
  id: string;
  phone: string;
  fullName: string | null;
  role: 'MANAGER' | 'ADMIN';
  /** Vrai tant que le mot de passe initial du script n'a pas été remplacé. */
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Connecte un gérant et renvoie un JWT.
   * En cas d'identifiants invalides, on renvoie le MÊME message pour ne pas
   * laisser deviner si c'est le téléphone ou le mot de passe qui est faux
   * (protection contre l'énumération de comptes).
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Mise à jour du lastLogin (best-effort, on n'attend pas)
    void this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Changement de mot de passe par le gérant connecté.
   *
   * L'ancien mot de passe est revérifié malgré l'authentification : un JWT
   * volé ne doit pas suffire à verrouiller le compte de son propriétaire.
   *
   * Limite assumée : les JWT déjà émis restent valides jusqu'à expiration
   * (24 h). Les révoquer supposerait un `tokenVersion` vérifié à chaque
   * requête — à ajouter le jour où un compte est réellement compromis, pas
   * avant (cf. docs/SECURITY.md §2).
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const currentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit être différent de l'ancien",
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        mustChangePassword: false,
      },
    });

    return { changed: true as const };
  }
}
