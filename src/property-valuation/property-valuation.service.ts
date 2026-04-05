import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface ValuationResult {
  estimatedValue: number;
  currency: string;
  source: 'zillow' | 'fallback';
  lastUpdated: Date;
  confidence: 'high' | 'medium' | 'low';
}

// Average price per square meter by country (in USD)
// These are rough estimates and should be updated periodically
const PRICE_PER_SQM_BY_COUNTRY: Record<string, number> = {
  US: 2500,
  GB: 5500,
  DE: 3500,
  FR: 4500,
  IL: 6500,
  CA: 3200,
  AU: 4000,
  NZ: 3500,
  JP: 5000,
  CH: 8000,
  NL: 4200,
  BE: 3000,
  IT: 2800,
  ES: 2200,
  PT: 2000,
  AT: 3800,
  IE: 4500,
  SE: 4000,
  NO: 4500,
  DK: 4200,
  FI: 3200,
  PL: 1800,
  CZ: 2500,
  HU: 1600,
  GR: 1500,
  TR: 800,
  RU: 1200,
  BR: 1500,
  MX: 1000,
  AR: 1800,
  CL: 2000,
  CO: 1200,
  IN: 600,
  CN: 2500,
  KR: 8000,
  SG: 15000,
  HK: 20000,
  AE: 4000,
  SA: 1500,
  ZA: 1000,
  EG: 500,
  NG: 800,
  KE: 600,
  TH: 1500,
  MY: 1200,
  ID: 800,
  PH: 1000,
  VN: 1200,
};

// Property type multipliers (relative to apartment baseline)
const PROPERTY_TYPE_MULTIPLIERS: Record<string, number> = {
  APARTMENT: 1.0,
  HOUSE: 1.15,
  LAND: 0.4,
  COMMERCIAL: 1.3,
  OTHER: 0.9,
};

// City tier multipliers (for major cities)
const CITY_MULTIPLIERS: Record<string, number> = {
  // US
  'new york': 2.5,
  'san francisco': 2.8,
  'los angeles': 2.0,
  miami: 1.8,
  boston: 1.9,
  seattle: 1.7,
  chicago: 1.3,
  austin: 1.5,
  denver: 1.4,
  // UK
  london: 2.2,
  manchester: 1.2,
  edinburgh: 1.3,
  // Germany
  munich: 1.8,
  berlin: 1.5,
  frankfurt: 1.6,
  hamburg: 1.4,
  // France
  paris: 2.0,
  nice: 1.5,
  lyon: 1.2,
  // Israel
  'tel aviv': 1.8,
  jerusalem: 1.3,
  haifa: 1.1,
  // Others
  sydney: 1.6,
  melbourne: 1.4,
  toronto: 1.5,
  vancouver: 1.7,
  tokyo: 1.6,
  osaka: 1.2,
  singapore: 1.0, // Already high base
  'hong kong': 1.0, // Already high base
  dubai: 1.3,
  zurich: 1.5,
  geneva: 1.6,
  amsterdam: 1.4,
};

@Injectable()
export class PropertyValuationService {
  private readonly logger = new Logger(PropertyValuationService.name);
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly rapidApiKey: string | undefined;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.rapidApiKey = this.configService.get<string>('RAPIDAPI_KEY');
  }

  async getValuation(propertyId: string, userId: string): Promise<ValuationResult> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        OR: [
          { userId },
          {
            shares: {
              some: {
                sharedWithUserId: userId,
                status: 'ACCEPTED',
              },
            },
          },
        ],
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check if we have a cached valuation that's still valid
    if (
      property.estimatedValue &&
      property.estimatedValueDate &&
      new Date().getTime() - property.estimatedValueDate.getTime() < this.CACHE_DURATION_MS
    ) {
      this.logger.log(`[valuation] cache hit propertyId=${propertyId}`);
      return {
        estimatedValue: Number(property.estimatedValue),
        currency: property.estimatedValueCurrency || 'USD',
        source: (property.valuationSource as 'zillow' | 'fallback') || 'fallback',
        lastUpdated: property.estimatedValueDate,
        confidence: property.valuationSource === 'zillow' ? 'high' : 'medium',
      };
    }

    // Calculate new valuation
    return this.calculateAndStoreValuation(property);
  }

  async refreshValuation(propertyId: string, userId: string): Promise<ValuationResult> {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        OR: [
          { userId },
          {
            shares: {
              some: {
                sharedWithUserId: userId,
                status: 'ACCEPTED',
                permission: 'EDIT',
              },
            },
          },
        ],
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or no edit permission');
    }

    return this.calculateAndStoreValuation(property);
  }

  private async calculateAndStoreValuation(property: {
    id: string;
    address?: string | null;
    country?: string | null;
    city?: string | null;
    size?: any;
    sizeUnit?: string | null;
    propertyType?: string | null;
  }): Promise<ValuationResult> {
    let result: ValuationResult;

    // Try Zillow API for US properties with address
    if (
      property.country === 'US' &&
      property.address &&
      this.rapidApiKey
    ) {
      try {
        result = await this.fetchZillowValuation(property.address);
        this.logger.log(`[valuation] Zillow success propertyId=${property.id}`);
      } catch (error) {
        this.logger.warn(
          `[valuation] Zillow failed propertyId=${property.id}, falling back to estimate: ${error}`,
        );
        result = this.calculateFallbackValuation(property);
      }
    } else {
      result = this.calculateFallbackValuation(property);
    }

    // Store the valuation
    await this.prisma.property.update({
      where: { id: property.id },
      data: {
        estimatedValue: result.estimatedValue,
        estimatedValueCurrency: result.currency,
        estimatedValueDate: result.lastUpdated,
        valuationSource: result.source,
      },
    });

    return result;
  }

  private async fetchZillowValuation(address: string): Promise<ValuationResult> {
    const url = `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?location=${encodeURIComponent(address)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': this.rapidApiKey!,
        'X-RapidAPI-Host': 'zillow-com1.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      throw new Error(`Zillow API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract the zestimate or listing price from the first result
    const firstResult = data?.props?.[0];
    if (!firstResult) {
      throw new Error('No property found in Zillow response');
    }

    const value = firstResult.zestimate || firstResult.price;
    if (!value || typeof value !== 'number') {
      throw new Error('No valid price in Zillow response');
    }

    return {
      estimatedValue: value,
      currency: 'USD',
      source: 'zillow',
      lastUpdated: new Date(),
      confidence: 'high',
    };
  }

  private calculateFallbackValuation(property: {
    country?: string | null;
    city?: string | null;
    size?: any;
    sizeUnit?: string | null;
    propertyType?: string | null;
  }): ValuationResult {
    const country = property.country?.toUpperCase() || 'US';
    const city = property.city?.toLowerCase() || '';
    const propertyType = property.propertyType || 'OTHER';
    let sizeInSqm = property.size ? Number(property.size) : 100; // Default 100 sqm

    // Convert sqft to sqm if needed
    if (property.sizeUnit === 'SQFT' && property.size) {
      sizeInSqm = Number(property.size) * 0.092903;
    }

    // Get base price per sqm for country
    const basePricePerSqm = PRICE_PER_SQM_BY_COUNTRY[country] || 2000;

    // Apply city multiplier
    const cityMultiplier = CITY_MULTIPLIERS[city] || 1.0;

    // Apply property type multiplier
    const typeMultiplier = PROPERTY_TYPE_MULTIPLIERS[propertyType] || 1.0;

    // Calculate estimated value
    const estimatedValue = Math.round(
      sizeInSqm * basePricePerSqm * cityMultiplier * typeMultiplier,
    );

    this.logger.log(
      `[valuation] fallback calculation: country=${country} city=${city} size=${sizeInSqm}sqm ` +
        `basePricePerSqm=${basePricePerSqm} cityMult=${cityMultiplier} typeMult=${typeMultiplier} ` +
        `result=${estimatedValue}`,
    );

    return {
      estimatedValue,
      currency: 'USD',
      source: 'fallback',
      lastUpdated: new Date(),
      confidence: property.size && property.country ? 'medium' : 'low',
    };
  }

  // Get available countries for dropdown
  getAvailableCountries(): Array<{ code: string; name: string }> {
    const countries: Array<{ code: string; name: string }> = [
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'FR', name: 'France' },
      { code: 'IL', name: 'Israel' },
      { code: 'CA', name: 'Canada' },
      { code: 'AU', name: 'Australia' },
      { code: 'NZ', name: 'New Zealand' },
      { code: 'JP', name: 'Japan' },
      { code: 'CH', name: 'Switzerland' },
      { code: 'NL', name: 'Netherlands' },
      { code: 'BE', name: 'Belgium' },
      { code: 'IT', name: 'Italy' },
      { code: 'ES', name: 'Spain' },
      { code: 'PT', name: 'Portugal' },
      { code: 'AT', name: 'Austria' },
      { code: 'IE', name: 'Ireland' },
      { code: 'SE', name: 'Sweden' },
      { code: 'NO', name: 'Norway' },
      { code: 'DK', name: 'Denmark' },
      { code: 'FI', name: 'Finland' },
      { code: 'PL', name: 'Poland' },
      { code: 'CZ', name: 'Czech Republic' },
      { code: 'HU', name: 'Hungary' },
      { code: 'GR', name: 'Greece' },
      { code: 'TR', name: 'Turkey' },
      { code: 'RU', name: 'Russia' },
      { code: 'BR', name: 'Brazil' },
      { code: 'MX', name: 'Mexico' },
      { code: 'AR', name: 'Argentina' },
      { code: 'CL', name: 'Chile' },
      { code: 'CO', name: 'Colombia' },
      { code: 'IN', name: 'India' },
      { code: 'CN', name: 'China' },
      { code: 'KR', name: 'South Korea' },
      { code: 'SG', name: 'Singapore' },
      { code: 'HK', name: 'Hong Kong' },
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'ZA', name: 'South Africa' },
      { code: 'EG', name: 'Egypt' },
      { code: 'NG', name: 'Nigeria' },
      { code: 'KE', name: 'Kenya' },
      { code: 'TH', name: 'Thailand' },
      { code: 'MY', name: 'Malaysia' },
      { code: 'ID', name: 'Indonesia' },
      { code: 'PH', name: 'Philippines' },
      { code: 'VN', name: 'Vietnam' },
    ];
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }
}
