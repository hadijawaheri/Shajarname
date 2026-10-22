import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MembersService } from './members.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly membersService: MembersService) {}

  async onModuleInit() {
    if (process.env.ENABLE_DEMO_SEED !== 'true') {
      this.logger.log('Demo seed is disabled');
      return;
    }

    const members = await this.membersService.findAll();
    if (members.length === 0) {
      await this.membersService.seedDemoFamily();
    } else {
      await this.membersService.ensureDemoLogin();
    }
  }
}
