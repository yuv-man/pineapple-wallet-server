import { Module } from '@nestjs/common';
import { PropertySharingService } from './property-sharing.service';
import { PropertySharingController } from './property-sharing.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [PropertySharingService],
  controllers: [PropertySharingController],
  exports: [PropertySharingService],
})
export class PropertySharingModule {}
