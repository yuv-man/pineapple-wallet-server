import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class NetWorthSnapshotService {
  constructor(
    private prisma: PrismaService,
    private currencyService: CurrencyService,
  ) {}

  async captureSnapshotForUser(userId: string): Promise<void> {
    const CURRENCY = 'USD';

    const [owned, shared] = await Promise.all([
      this.prisma.portfolio.findMany({
        where: { userId },
        include: { assets: true },
      }),
      this.prisma.portfolio.findMany({
        where: {
          shares: {
            some: { sharedWithUserId: userId, status: 'ACCEPTED' },
          },
        },
        include: { assets: true },
      }),
    ]);

    let totalAssets = 0;
    for (const p of [...owned, ...shared]) {
      for (const a of p.assets) {
        totalAssets += await this.currencyService.convert(
          Number(a.value),
          a.currency,
          CURRENCY,
        );
      }
    }

    const liabilities = await this.prisma.liability.findMany({
      where: { userId },
    });
    let totalLiabilities = 0;
    for (const l of liabilities) {
      totalLiabilities += await this.currencyService.convert(
        Number(l.balance),
        l.currency,
        CURRENCY,
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await this.prisma.netWorthSnapshot.upsert({
      where: { userId_snapshotDate: { userId, snapshotDate: today } },
      update: {
        totalAssets: new Decimal(totalAssets),
        totalLiabilities: new Decimal(totalLiabilities),
        netWorth: new Decimal(totalAssets - totalLiabilities),
      },
      create: {
        userId,
        totalAssets: new Decimal(totalAssets),
        totalLiabilities: new Decimal(totalLiabilities),
        netWorth: new Decimal(totalAssets - totalLiabilities),
        currency: CURRENCY,
        snapshotDate: today,
      },
    });
  }

  async captureSnapshotForAllUsers(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      await this.captureSnapshotForUser(u.id);
    }
  }

  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async handleDailySnapshot() {
    await this.captureSnapshotForAllUsers();
  }

  async getHistory(userId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.netWorthSnapshot.findMany({
      where: { userId, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });
  }
}
