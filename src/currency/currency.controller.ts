import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('currency')
export class CurrencyController {
  constructor(
    private currencyService: CurrencyService,
    private prisma: PrismaService,
  ) {}

  @Get('supported')
  getSupportedCurrencies() {
    return this.currencyService.getSupportedCurrencies();
  }

  @Get('rates')
  async getExchangeRates(@Query('base') baseCurrency: string = 'USD') {
    return this.currencyService.getExchangeRates(baseCurrency);
  }

  @Get('convert')
  async convert(
    @Query('amount') amount: string,
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
  ) {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return { error: 'Invalid amount' };
    }

    const convertedValue = await this.currencyService.convert(
      numAmount,
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase(),
    );

    return {
      amount: numAmount,
      from: fromCurrency.toUpperCase(),
      to: toCurrency.toUpperCase(),
      convertedValue,
      rate: convertedValue / numAmount,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('net-worth')
  async getNetWorth(
    @CurrentUser() user: any,
    @Query('currency') targetCurrency: string = 'USD',
  ) {
    // Get all portfolios owned by user
    const ownedPortfolios = await this.prisma.portfolio.findMany({
      where: { userId: user.sub },
      include: { assets: true },
    });

    // Get all portfolios shared with user (accepted only)
    const sharedPortfolios = await this.prisma.portfolio.findMany({
      where: {
        shares: {
          some: {
            sharedWithUserId: user.sub,
            status: 'ACCEPTED',
          },
        },
      },
      include: { assets: true },
    });

    const allPortfolios = [...ownedPortfolios, ...sharedPortfolios];

    return this.currencyService.getNetWorth(
      allPortfolios,
      targetCurrency.toUpperCase(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('portfolio-summary')
  async getPortfolioSummary(
    @CurrentUser() user: any,
    @Query('portfolioId') portfolioId: string,
    @Query('currency') targetCurrency: string = 'USD',
  ) {
    // Verify user has access to this portfolio
    const portfolio = await this.prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        OR: [
          { userId: user.sub },
          {
            shares: {
              some: {
                sharedWithUserId: user.sub,
                status: 'ACCEPTED',
              },
            },
          },
        ],
      },
      include: { assets: true },
    });

    if (!portfolio) {
      return { error: 'Portfolio not found or access denied' };
    }

    return this.currencyService.getPortfolioSummary(
      portfolio.assets,
      targetCurrency.toUpperCase(),
    );
  }
}
