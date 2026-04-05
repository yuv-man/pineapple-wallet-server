import { Module } from '@nestjs/common';
import { PropertyValuationService } from './property-valuation.service';
import { PropertyValuationController } from './property-valuation.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PropertyValuationController],
  providers: [PropertyValuationService],
  exports: [PropertyValuationService],
})
export class PropertyValuationModule {}
