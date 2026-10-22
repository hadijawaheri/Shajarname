import { Module, Global } from '@nestjs/common';
import { FamilyGateway } from './family.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  providers: [FamilyGateway],
  exports: [FamilyGateway],
})
export class FamilyModule {}
