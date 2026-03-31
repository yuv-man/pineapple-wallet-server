import { Module } from '@nestjs/common';
import { PropertyCategoriesService } from './property-categories.service';
import { PropertyCategoriesController } from './property-categories.controller';

@Module({
  providers: [PropertyCategoriesService],
  controllers: [PropertyCategoriesController],
  exports: [PropertyCategoriesService],
})
export class PropertyCategoriesModule {}
