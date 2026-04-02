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

  private describeError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}`;
    }
    return typeof err === 'string' ? err : JSON.stringify(err);
  }

  async getExchangeRates(baseCurrency: string = 'USD'): Promise<ExchangeRates> {
    const now = new Date();
    const base = String(baseCurrency).toUpperCase();

    // Return cached rates if still valid
    if (
      this.exchangeRates &&
      this.exchangeRates.base === base &&
      this.lastFetchTime &&
      now.getTime() - this.lastFetchTime.getTime() < this.CACHE_DURATION_MS
    ) {
      const ageMs = now.getTime() - this.lastFetchTime.getTime();
      this.logger.log(
        `[rates] cache hit base=${base} ageMs=${ageMs} ttlMs=${this.CACHE_DURATION_MS}`,
      );
      return this.exchangeRates;
    }

    this.logger.log(
      `[rates] fetch start base=${base} hadCachedCryptoKeys=${Object.keys(this.cryptoRates).length}`,
    );

    try {
      const frankfurterUrl = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`;
      const t0 = Date.now();
      const fiatResponse = await fetch(frankfurterUrl, {
        headers: OUTBOUND_FETCH_HEADERS,
      });
      const fiatMs = Date.now() - t0;

      if (!fiatResponse.ok) {
        let bodySnippet = '';
        try {
          bodySnippet = (await fiatResponse.text()).slice(0, 500);
        } catch {
          bodySnippet = '(could not read body)';
        }
        this.logger.error(
          `[rates] Frankfurter HTTP error base=${base} status=${fiatResponse.status} statusText=${fiatResponse.statusText} ms=${fiatMs} bodySnippet=${JSON.stringify(bodySnippet)}`,
        );
        throw new Error(`Frankfurter HTTP ${fiatResponse.status}`);
      }

      let fiatData: { rates?: Record<string, number> };
      try {
        fiatData = (await fiatResponse.json()) as { rates?: Record<string, number> };
      } catch (parseErr: unknown) {
        this.logger.error(
          `[rates] Frankfurter JSON parse failed base=${base} ms=${fiatMs} err=${this.describeError(parseErr)}`,
        );
        throw parseErr;
      }

      const fiatRates = fiatData.rates || {};
      const fiatKeys = Object.keys(fiatRates).length;
      this.logger.log(
        `[rates] Frankfurter ok base=${base} fiatPairCount=${fiatKeys} hasUsdCross=${fiatRates['USD'] !== undefined} ms=${fiatMs}`,
      );

      // Crypto: Binance USDT prices, converted into `baseCurrency` via Frankfurter fiat rates
      const cryptoRates = await this.fetchCryptoRates(base, fiatRates);

      const merged = {
        [base]: 1,
        ...fiatRates,
        ...cryptoRates,
      };
      this.exchangeRates = {
        base,
        rates: merged,
        lastUpdated: new Date(),
      };

      this.lastFetchTime = now;
      const cryptoKeys = Object.keys(cryptoRates).length;
      this.logger.log(
        `[rates] success base=${base} totalKeys=${Object.keys(merged).length} cryptoKeys=${cryptoKeys}`,
      );

      return this.exchangeRates;
    } catch (error) {
      this.logger.error(
        `[rates] live fetch failed base=${base} → fallback static rates. ${this.describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.getFallbackRates(base);
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
    const base = baseCurrency.toUpperCase();
    try {
      const t0 = Date.now();
      const response = await fetch(BINANCE_TICKER_URL, {
        headers: OUTBOUND_FETCH_HEADERS,
      });
      const binanceMs = Date.now() - t0;

      if (!response.ok) {
        let bodySnippet = '';
        try {
          bodySnippet = (await response.text()).slice(0, 500);
        } catch {
          bodySnippet = '(could not read body)';
        }
        this.logger.error(
          `[rates] Binance HTTP error base=${base} status=${response.status} statusText=${response.statusText} ms=${binanceMs} bodySnippet=${JSON.stringify(bodySnippet)}`,
        );
        throw new Error(`Binance ticker HTTP ${response.status}`);
      }

      let rows: unknown;
      try {
        rows = await response.json();
      } catch (parseErr: unknown) {
        this.logger.error(
          `[rates] Binance JSON parse failed base=${base} ms=${binanceMs} err=${this.describeError(parseErr)}`,
        );
        throw parseErr;
      }

      if (!Array.isArray(rows)) {
        const typeDesc = rows === null ? 'null' : typeof rows;
        this.logger.error(
          `[rates] Binance unexpected shape base=${base} type=${typeDesc} ms=${binanceMs} sample=${JSON.stringify(rows).slice(0, 300)}`,
        );
        throw new Error('Unexpected Binance ticker response');
      }

      const byTicker = new Map<string, number>();
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const r = row as { symbol?: string; price?: string };
        if (typeof r.symbol !== 'string' || typeof r.price !== 'string') continue;
        const price = parseFloat(r.price);
        if (Number.isFinite(price) && price > 0) {
          byTicker.set(r.symbol, price);
        }
      }

      const priceUsdPerCoin: Record<string, number> = {};
      const missingFromBinance: string[] = [];
      for (const { asset, ticker } of BINANCE_USDT_PAIRS) {
        const p = byTicker.get(ticker);
        if (p !== undefined) {
          priceUsdPerCoin[asset] = p;
        } else {
          missingFromBinance.push(ticker);
        }
      }

      // Frankfurter: rates['USD'] = USD per 1 unit of base (not present when base is USD).
      const rawUsd = base === 'USD' ? 1 : fiatRates['USD'];
      const u =
        typeof rawUsd === 'number' && Number.isFinite(rawUsd) && rawUsd > 0 ? rawUsd : 1;

      this.logger.log(
        `[rates] Binance ok base=${base} rowCount=${rows.length} tickersParsed=${byTicker.size} usdPerOneBase=${u} (Frankfurter USD field=${fiatRates['USD'] ?? 'absent'}) ms=${binanceMs}`,
      );

      if (missingFromBinance.length > 0) {
        this.logger.warn(
          `[rates] Binance missing tickers base=${base}: ${missingFromBinance.join(', ')}`,
        );
      }

      if (base !== 'USD' && u === 1 && fiatRates['USD'] === undefined) {
        this.logger.warn(
          `[rates] No USD cross-rate from Frankfurter for base=${base}; crypto uses usdPerOneBase=1 (likely wrong vs USD)`,
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

      if (Object.keys(rates).length <= 1) {
        this.logger.warn(
          `[rates] Binance produced almost no crypto rates base=${base} keys=${Object.keys(rates).join(',')}`,
        );
      }

      this.cryptoRates = rates;
      return rates;
    } catch (error) {
      this.logger.warn(
        `[rates] Binance path failed base=${base} returning stale crypto cache (keys=${Object.keys(this.cryptoRates).length}). ${this.describeError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.cryptoRates;
    }
  }

  private getFallbackRates(baseCurrency: string): ExchangeRates {
    const base = baseCurrency.toUpperCase();
    this.logger.warn(
      `[rates] using static fallback rates base=${base} (live Frankfurter/Binance unavailable or parse error — see earlier [rates] error logs)`,
    );
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

    if (base === 'USD') {
      return {
        base: 'USD',
        rates: usdRates,
        lastUpdated: new Date(),
      };
    }

    // Convert all rates to the requested base currency
    const baseRate = (usdRates as Record<string, number>)[base] ?? 1;
    const convertedRates: Record<string, number> = {};

    for (const [currency, rate] of Object.entries(usdRates)) {
      convertedRates[currency] = rate / baseRate;
    }

    return {
      base,
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
