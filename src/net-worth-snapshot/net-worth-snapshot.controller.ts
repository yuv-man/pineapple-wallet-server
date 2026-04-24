import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NetWorthSnapshotService } from './net-worth-snapshot.service';
import { CurrencyService } from '../currency/currency.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const ALLOWED_DAYS = [30, 90, 180, 365];

@Controller('net-worth-history')
@UseGuards(JwtAuthGuard)
export class NetWorthSnapshotController {
  constructor(
    private netWorthSnapshotService: NetWorthSnapshotService,
    private currencyService: CurrencyService,
  ) {}

  @Get()
  async getHistory(
    @CurrentUser() user: any,
    @Query('days') daysParam: string = '30',
    @Query('currency') currency: string = 'USD',
  ) {
    const parsed = parseInt(daysParam, 10);
    const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;
    const targetCurrency = currency.toUpperCase();

    const snapshots = await this.netWorthSnapshotService.getHistory(
      user.sub,
      days,
    );

    const data = await Promise.all(
      snapshots.map(async (s) => ({
        date: s.snapshotDate.toISOString(),
        totalAssets: await this.currencyService.convert(
          Number(s.totalAssets),
          'USD',
          targetCurrency,
        ),
        totalLiabilities: await this.currencyService.convert(
          Number(s.totalLiabilities),
          'USD',
          targetCurrency,
        ),
        netWorth: await this.currencyService.convert(
          Number(s.netWorth),
          'USD',
          targetCurrency,
        ),
      })),
    );

    return { currency: targetCurrency, data };
  }

  @Post('snapshot-now')
  async snapshotNow(@CurrentUser() user: any) {
    await this.netWorthSnapshotService.captureSnapshotForUser(user.sub);
    return { message: 'Snapshot captured' };
  }
}
