import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import sharp from 'sharp';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { Member, MemberDocument } from './schemas';
import { FamilyGateway } from 'src/family/family.gateway';

@Injectable()
export class UploadService {
  private readonly avatarsDir = join(process.cwd(), 'public', 'avatars');
  private readonly photosDir = join(process.cwd(), 'public', 'gallery', 'photos');
  private readonly audioDir = join(process.cwd(), 'public', 'gallery', 'audio');

  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    private readonly familyGateway: FamilyGateway,
  ) {
    for (const dir of [this.avatarsDir, this.photosDir, this.audioDir]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  async uploadAvatar(memberId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل تصویر الزامی است');

    const mime = file.mimetype.toLowerCase();
    const isImage = mime.startsWith('image/') || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg'].includes(mime);
    if (!isImage) {
      throw new BadRequestException('فرمت تصویر مجاز نیست (JPEG, PNG, WebP)');
    }

    const filename = `${memberId}.webp`;
    const outputPath = join(this.avatarsDir, filename);

    await sharp(file.buffer)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 95 })
      .toFile(outputPath);

    const avatarPath = `/public/avatars/${filename}?v=${Date.now()}`;
    const updated = await this.memberModel.findOneAndUpdate(
      { _id: memberId, deleted: false },
      { $set: { avatar: avatarPath } },
      { new: true },
    );

    if (!updated) throw new BadRequestException('عضو یافت نشد');

    this.familyGateway.broadcast('avatar:updated', { memberId, avatar: avatarPath });
    return { avatar: avatarPath, member: updated };
  }

  async uploadGalleryPhoto(memberId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل تصویر الزامی است');

    const mime = file.mimetype.toLowerCase();
    const isImage = mime.startsWith('image/') || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/pjpeg'].includes(mime);
    if (!isImage) {
      throw new BadRequestException('فرمت تصویر مجاز نیست');
    }

    const filename = `${memberId}-${randomUUID()}.webp`;
    const outputPath = join(this.photosDir, filename);

    await sharp(file.buffer)
      .rotate()
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 95 })
      .toFile(outputPath);

    const photoPath = `/public/gallery/photos/${filename}`;
    const updated = await this.memberModel.findOneAndUpdate(
      { _id: memberId, deleted: false },
      { $push: { photos: photoPath } },
      { new: true },
    );

    if (!updated) throw new BadRequestException('عضو یافت نشد');

    this.familyGateway.broadcast('member:updated', { member: updated });
    return { photo: photoPath, member: updated };
  }

  async uploadAudioMemory(memberId: string, file: Express.Multer.File, title: string) {
    if (!file) throw new BadRequestException('فایل صوتی الزامی است');

    const mime = file.mimetype.toLowerCase();
    const isAudio = mime.startsWith('audio/') || mime === 'video/webm' || mime === 'video/mp4';
    if (!isAudio) {
      throw new BadRequestException('فرمت صوتی مجاز نیست (MP3, WAV, OGG, WebM, M4A, AAC)');
    }

    let ext = 'mp3';
    if (mime.includes('wav')) ext = 'wav';
    else if (mime.includes('ogg')) ext = 'ogg';
    else if (mime.includes('webm')) ext = 'webm';
    else if (mime.includes('m4a') || mime.includes('mp4') || mime.includes('aac')) ext = 'm4a';

    const filename = `${memberId}-${randomUUID()}.${ext}`;
    const outputPath = join(this.audioDir, filename);
    writeFileSync(outputPath, file.buffer);

    const audioPath = `/public/gallery/audio/${filename}`;
    const memory = { title: title || 'خاطره', path: audioPath };

    const updated = await this.memberModel.findOneAndUpdate(
      { _id: memberId, deleted: false },
      { $push: { audioMemories: memory } },
      { new: true },
    );

    if (!updated) throw new BadRequestException('عضو یافت نشد');

    this.familyGateway.broadcast('member:updated', { member: updated });
    return { audio: memory, member: updated };
  }
}
