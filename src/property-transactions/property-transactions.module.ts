import { Module } from '@nestjs/common';
import { PropertyTransactionsService } from './property-transactions.service';
import { PropertyTransactionsController } from './property-transactions.controller';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [PropertiesModule],
  providers: [PropertyTransactionsService],
  controllers: [PropertyTransactionsController],
  exports: [PropertyTransactionsService],
})
export class PropertyTransactionsModule {}
