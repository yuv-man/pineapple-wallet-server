import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: Date;
}

export interface ConvertedAsset {
  id: string;
  name: string;
  type: string;
  originalValue: number;
  originalCurrency: string;
  convertedValue: number;
  targetCurrency: string;
  exchangeRate: number;
}

export interface PortfolioSummary {
  totalValue: number;
  currency: string;
  assetsByType: Record<string, { count: number; totalValue: number }>;
  assets: ConvertedAsset[];
  lastUpdated: Date;
}

/** Identifiable client for outbound HTTP (avoids blocks on default Node UA in some regions). */
const OUTBOUND_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'PineappleWalletBackend/1.0',
} as const;

/** Binance USDT spot tickers — generous public limits, works reliably from cloud hosts. */
const BINANCE_USDT_PAIRS: Array<{ asset: string; ticker: string }> = [
  { asset: 'BTC', ticker: 'BTCUSDT' },
  { asset: 'ETH', ticker: 'ETHUSDT' },
  { asset: 'BNB', ticker: 'BNBUSDT' },
  { asset: 'XRP', ticker: 'XRPUSDT' },
  { asset: 'ADA', ticker: 'ADAUSDT' },
  { asset: 'SOL', ticker: 'SOLUSDT' },
  { asset: 'DOGE', ticker: 'DOGEUSDT' },
];

const BINANCE_TICKER_URL =
  'https://api.binance.com/api/v3/ticker/price?symbols=' +
  encodeURIComponent(
    JSON.stringify(BINANCE_USDT_PAIRS.map((p) => p.ticker)),
  );

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private exchangeRates: ExchangeRates | null = null;
  private cryptoRates: Record<string, number> = {};
  private lastFetchTime: Date | null = null;
  private readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour cache

  // Supported fiat currencies
  private readonly FIAT_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
    'CNY', 'INR', 'MXN', 'BRL', 'KRW', 'SGD', 'HKD', 'SEK',
    'NOK', 'DKK', 'PLN', 'ZAR', 'ILS'
  ];

  // Supported cryptocurrencies
  private readonly CRYPTO_CURRENCIES = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE'];

  async getExchangeRates(baseCurrency: string = 'USD'): Promise<ExchangeRates> {
    const now = new Date();

    // Return cached rates if still valid
    if (
      this.exchangeRates &&
      this.exchangeRates.base === baseCurrency &&
      this.lastFetchTime &&
      now.getTime() - this.lastFetchTime.getTime() < this.CACHE_DURATION_MS
    ) {
      return this.exchangeRates;
    }

    try {
      // Fetch fiat exchange rates from Frankfurter API (free, no API key needed)
      const fiatResponse = await fetch(
        `https://api.frankfurter.app/latest?from=${baseCurrency}`,
        { headers: OUTBOUND_FETCH_HEADERS },
      );

      if (!fiatResponse.ok) {
        throw new Error('Failed to fetch fiat exchange rates');
      }

      const fiatData = await fiatResponse.json();

      // Crypto: Binance USDT prices, converted into `baseCurrency` via Frankfurter fiat rates
      const cryptoRates = await this.fetchCryptoRates(
        baseCurrency,
        (fiatData.rates as Record<string, number>) || {},
      );

      this.exchangeRates = {
        base: baseCurrency,
        rates: {
          [baseCurrency]: 1,
          ...fiatData.rates,
          ...cryptoRates,
        },
        lastUpdated: new Date(),
      };

      this.lastFetchTime = now;
      this.logger.log(`Exchange rates updated for base currency: ${baseCurrency}`);

      return this.exchangeRates;
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates, using fallback', error);
      return this.getFallbackRates(baseCurrency);
    }
  }

  /**
   * How much of each crypto you get for 1 unit of `baseCurrency` (same shape as before).
   * Binance quotes USDT≈USD; Frankfurter `fiatRates` is "foreign per 1 base" (includes USD when base ≠ USD).
   */
  private async fetchCryptoRates(
    baseCurrency: string,
    fiatRates: Record<string, number>,
  ): Promise<Record<string, number>> {
    try {
      const response = await fetch(BINANCE_TICKER_URL, {
        headers: OUTBOUND_FETCH_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`Binance ticker HTTP ${response.status}`);
      }

      const rows = (await response.json()) as Array<{ symbol: string; price: string }>;
      if (!Array.isArray(rows)) {
        throw new Error('Unexpected Binance ticker response');
      }

      const byTicker = new Map<string, number>();
      for (const row of rows) {
        const price = parseFloat(row.price);
        if (Number.isFinite(price) && price > 0) {
          byTicker.set(row.symbol, price);
        }
      }

      const priceUsdPerCoin: Record<string, number> = {};
      for (const { asset, ticker } of BINANCE_USDT_PAIRS) {
        const p = byTicker.get(ticker);
        if (p !== undefined) {
          priceUsdPerCoin[asset] = p;
        }
      }

      const base = baseCurrency.toUpperCase();
      // Frankfurter: rates['USD'] = USD per 1 unit of base (not present when base is USD).
      const rawUsd = base === 'USD' ? 1 : fiatRates['USD'];
      const u =
        typeof rawUsd === 'number' && Number.isFinite(rawUsd) && rawUsd > 0 ? rawUsd : 1;

      if (base !== 'USD' && u === 1 && fiatRates['USD'] === undefined) {
        this.logger.warn(
          `No USD cross-rate from Frankfurter for base ${base}; using u=1 for crypto (check fiat list)`,
        );
      }

      const rates: Record<string, number> = {};
      for (const { asset } of BINANCE_USDT_PAIRS) {
        const p = priceUsdPerCoin[asset];
        if (p !== undefined) {
          rates[asset] = u / p;
        }
      }

      // USDT ≈ 1 USD (no USDTUSDT pair needed)
      rates['USDT'] = u;

      this.cryptoRates = rates;
      return rates;
    } catch (error) {
      this.logger.warn('Failed to fetch crypto rates from Binance, using cached or empty', error);
      return this.cryptoRates;
    }
  }

  private getFallbackRates(baseCurrency: string): ExchangeRates {
    // Fallback rates (approximate, for when API is unavailable)
    const usdRates: Record<string, number> = {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      ILS: 3.65,
      JPY: 149.50,
      CHF: 0.88,
      CAD: 1.36,
      AUD: 1.53,
      NZD: 1.64,
      CNY: 7.24,
      INR: 83.12,
      BTC: 0.000023, // ~$43,000 per BTC
      ETH: 0.00043,  // ~$2,300 per ETH
      USDT: 1,
    };

    if (baseCurrency === 'USD') {
      return {
        base: 'USD',
        rates: usdRates,
        lastUpdated: new Date(),
      };
    }

    // Convert all rates to the requested base currency
    const baseRate = usdRates[baseCurrency] || 1;
    const convertedRates: Record<string, number> = {};

    for (const [currency, rate] of Object.entries(usdRates)) {
      convertedRates[currency] = rate / baseRate;
    }

    return {
      base: baseCurrency,
      rates: convertedRates,
      lastUpdated: new Date(),
    };
  }

  async convert(
    amount: number | Decimal,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    const numAmount = typeof amount === 'number' ? amount : Number(amount);

    if (fromCurrency === toCurrency) {
      return numAmount;
    }

    const rates = await this.getExchangeRates(toCurrency);

    // Get the rate to convert FROM currency to the target currency
    const fromRate = rates.rates[fromCurrency];

    if (!fromRate) {
      this.logger.warn(`No exchange rate found for ${fromCurrency}, using 1:1`);
      return numAmount;
    }

    // Since rates are relative to toCurrency, we divide by fromRate
    return numAmount / fromRate;
  }

  async convertAsset(
    asset: {
      id: string;
      name: string;
      type: string;
      value: number | Decimal;
      currency: string;
    },
    targetCurrency: string,
  ): Promise<ConvertedAsset> {
    const originalValue = typeof asset.value === 'number'
      ? asset.value
      : Number(asset.value);

    const convertedValue = await this.convert(
      originalValue,
      asset.currency,
      targetCurrency,
    );

    const exchangeRate = originalValue !== 0
      ? convertedValue / originalValue
      : 0;

    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      originalValue,
      originalCurrency: asset.currency,
      convertedValue,
      targetCurrency,
      exchangeRate,
    };
  }

  async getPortfolioSummary(
    assets: Array<{
      id: string;
      name: string;
      type: string;
      value: number | Decimal;
      currency: string;
    }>,
    targetCurrency: string,
  ): Promise<PortfolioSummary> {
    const convertedAssets: ConvertedAsset[] = [];
    const assetsByType: Record<string, { count: number; totalValue: number }> = {};
    let totalValue = 0;

    for (const asset of assets) {
      const converted = await this.convertAsset(asset, targetCurrency);
      convertedAssets.push(converted);
      totalValue += converted.convertedValue;

      if (!assetsByType[asset.type]) {
        assetsByType[asset.type] = { count: 0, totalValue: 0 };
      }
      assetsByType[asset.type].count += 1;
      assetsByType[asset.type].totalValue += converted.convertedValue;
    }

    return {
      totalValue,
      currency: targetCurrency,
      assetsByType,
      assets: convertedAssets,
      lastUpdated: new Date(),
    };
  }

  async getNetWorth(
    portfolios: Array<{
      assets: Array<{
        id: string;
        name: string;
        type: string;
        value: number | Decimal;
        currency: string;
      }>;
    }>,
    targetCurrency: string,
  ): Promise<{
    totalNetWorth: number;
    currency: string;
    portfolioCount: number;
    assetCount: number;
    byType: Record<string, { count: number; totalValue: number }>;
    lastUpdated: Date;
  }> {
    let totalNetWorth = 0;
    let assetCount = 0;
    const byType: Record<string, { count: number; totalValue: number }> = {};

    for (const portfolio of portfolios) {
      for (const asset of portfolio.assets) {
        const convertedValue = await this.convert(
          asset.value,
          asset.currency,
          targetCurrency,
        );

        totalNetWorth += convertedValue;
        assetCount += 1;

        if (!byType[asset.type]) {
          byType[asset.type] = { count: 0, totalValue: 0 };
        }
        byType[asset.type].count += 1;
        byType[asset.type].totalValue += convertedValue;
      }
    }

    return {
      totalNetWorth,
      currency: targetCurrency,
      portfolioCount: portfolios.length,
      assetCount,
      byType,
      lastUpdated: new Date(),
    };
  }

  getSupportedCurrencies(): { fiat: string[]; crypto: string[] } {
    return {
      fiat: this.FIAT_CURRENCIES,
      crypto: this.CRYPTO_CURRENCIES,
    };
  }
}
