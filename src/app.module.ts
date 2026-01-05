import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { AssetsModule } from './assets/assets.module';
import { SharingModule } from './sharing/sharing.module';
import { PrismaModule } from './prisma/prisma.module';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CurrencyModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    AssetsModule,
    SharingModule,
  ],
})
export class AppModule {}
