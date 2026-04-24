import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { AssetsModule } from './assets/assets.module';
import { SharingModule } from './sharing/sharing.module';
import { PrismaModule } from './prisma/prisma.module';
import { CurrencyModule } from './currency/currency.module';
import { PropertiesModule } from './properties/properties.module';
import { PropertyTransactionsModule } from './property-transactions/property-transactions.module';
import { PropertyCategoriesModule } from './property-categories/property-categories.module';
import { PropertySharingModule } from './property-sharing/property-sharing.module';
import { PropertyValuationModule } from './property-valuation/property-valuation.module';
import { LiabilitiesModule } from './liabilities/liabilities.module';
import { NetWorthSnapshotModule } from './net-worth-snapshot/net-worth-snapshot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CurrencyModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    AssetsModule,
    SharingModule,
    PropertiesModule,
    PropertyTransactionsModule,
    PropertyCategoriesModule,
    PropertySharingModule,
    PropertyValuationModule,
    LiabilitiesModule,
    NetWorthSnapshotModule,
  ],
})
export class AppModule {}
