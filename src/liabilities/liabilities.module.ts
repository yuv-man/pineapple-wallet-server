import { Module } from '@nestjs/common';
import { LiabilitiesService } from './liabilities.service';
import { LiabilitiesController } from './liabilities.controller';

@Module({
  providers: [LiabilitiesService],
  controllers: [LiabilitiesController],
})
export class LiabilitiesModule {}
