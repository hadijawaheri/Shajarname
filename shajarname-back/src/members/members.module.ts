// NestJS
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Services
import { MembersService } from './members.service';
import { UploadService } from './upload.service';
import { SeedService } from './seed.service';

// Controllers
import { MembersController } from './members.controller';

// Schemas
import { Member, MemberSchema, Marriage, MarriageSchema } from './schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Marriage.name, schema: MarriageSchema },
    ]),
  ],
  controllers: [MembersController],
  providers: [MembersService, UploadService, SeedService],
  exports: [MembersService],
})
export class MembersModule {}
