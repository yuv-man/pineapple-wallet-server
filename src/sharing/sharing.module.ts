import { Module } from '@nestjs/common';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [SharingService],
  controllers: [SharingController],
  exports: [SharingService],
})
export class SharingModule {}
