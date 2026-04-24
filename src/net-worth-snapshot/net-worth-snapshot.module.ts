import { Module } from '@nestjs/common';
import { NetWorthSnapshotService } from './net-worth-snapshot.service';
import { NetWorthSnapshotController } from './net-worth-snapshot.controller';

@Module({
  providers: [NetWorthSnapshotService],
  controllers: [NetWorthSnapshotController],
})
export class NetWorthSnapshotModule {}
