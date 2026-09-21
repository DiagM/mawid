import {
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

class ConfirmPhotoDto {
  /**
   * Identifiant Cloudinary, pas une URL : l'adresse définitive est relue
   * auprès de Cloudinary, jamais acceptée depuis le navigateur.
   */
  @IsString()
  @Length(1, 300)
  publicId!: string;
}

class RemovePhotoDto {
  @IsString()
  @IsUrl()
  @Length(1, 500)
  url!: string;
}

class ReorderPhotosDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  photos!: string[];
}

/**
 * Photos du salon du gérant connecté.
 *
 * Aucun identifiant de salon n'est accepté : il vient du JWT
 * (CLAUDE.md §3.2). Les photos publiques, elles, sortent déjà par la fiche
 * salon et la recherche.
 */
@Controller('salons/me/photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /** POST /api/salons/me/photos/signature */
  @Post('signature')
  sign(@CurrentUser() user: AuthenticatedUser) {
    return this.photosService.signUpload(user.id);
  }

  /** POST /api/salons/me/photos — enregistre une photo déposée. */
  @Post()
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPhotoDto,
  ) {
    return this.photosService.confirm(user.id, dto.publicId);
  }

  @Delete()
  remove(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemovePhotoDto) {
    return this.photosService.remove(user.id, dto.url);
  }

  /** PATCH /api/salons/me/photos — la première photo est la vitrine. */
  @Patch()
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderPhotosDto,
  ) {
    return this.photosService.reorder(user.id, dto.photos);
  }
}
