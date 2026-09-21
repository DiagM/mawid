import { Module } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [PhotosController],
  providers: [PhotosService, CloudinaryService],
})
export class PhotosModule {}
