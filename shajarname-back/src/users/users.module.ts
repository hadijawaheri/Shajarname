import { Module } from '@nestjs/common';
import { MembersModule } from 'src/members/members.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './users.controller';

@Module({
  imports: [MembersModule, AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
