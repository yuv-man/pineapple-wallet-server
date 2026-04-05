import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface ValuationResult {
  estimatedValue: number;
  currency: string;
  source: 'gemini' | 'zillow' | 'fallback';
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

// Country code to name mapping for Gemini prompt
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  IL: 'Israel',
  CA: 'Canada',
  AU: 'Australia',
  NZ: 'New Zealand',
  JP: 'Japan',
  CH: 'Switzerland',
  NL: 'Netherlands',
  BE: 'Belgium',
  IT: 'Italy',
  ES: 'Spain',
  PT: 'Portugal',
  AT: 'Austria',
  IE: 'Ireland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  GR: 'Greece',
  TR: 'Turkey',
  RU: 'Russia',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  IN: 'India',
  CN: 'China',
  KR: 'South Korea',
  SG: 'Singapore',
  HK: 'Hong Kong',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  ZA: 'South Africa',
  EG: 'Egypt',
  NG: 'Nigeria',
  KE: 'Kenya',
  TH: 'Thailand',
  MY: 'Malaysia',
  ID: 'Indonesia',
  PH: 'Philippines',
  VN: 'Vietnam',
};

const PROPERTY_TYPE_NAMES: Record<string, string> = {
  APARTMENT: 'Apartment',
  HOUSE: 'House',
  LAND: 'Land',
  COMMERCIAL: 'Commercial Property',
  OTHER: 'Property',
};

@Injectable()
export class PropertyValuationService {
  private readonly logger = new Logger(PropertyValuationService.name);
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly rapidApiKey: string | undefined;
  private readonly geminiApiKey: string | undefined;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.rapidApiKey = this.configService.get<string>('RAPIDAPI_KEY');
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
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
        source: (property.valuationSource as 'gemini' | 'zillow' | 'fallback') || 'fallback',
        lastUpdated: property.estimatedValueDate,
        confidence: this.getConfidenceLevel(property.valuationSource),
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

  private getConfidenceLevel(source: string | null): 'high' | 'medium' | 'low' {
    switch (source) {
      case 'gemini':
        return 'high';
      case 'zillow':
        return 'high';
      case 'fallback':
        return 'medium';
      default:
        return 'low';
    }
  }

  private async calculateAndStoreValuation(property: {
    id: string;
    name: string;
    address?: string | null;
    country?: string | null;
    city?: string | null;
    size?: any;
    sizeUnit?: string | null;
    propertyType?: string | null;
  }): Promise<ValuationResult> {
    let result: ValuationResult | null = null;

    // Try Gemini API first (works globally)
    if (this.geminiApiKey && property.country) {
      try {
        result = await this.fetchGeminiValuation(property);
        this.logger.log(`[valuation] Gemini success propertyId=${property.id}`);
      } catch (error) {
        this.logger.warn(
          `[valuation] Gemini failed propertyId=${property.id}: ${error}`,
        );
        // Fall through to next option
      }
    }

    // Try Zillow API for US properties with address (if Gemini failed or unavailable)
    if (
      !result &&
      property.country === 'US' &&
      property.address &&
      this.rapidApiKey
    ) {
      try {
        result = await this.fetchZillowValuation(property.address);
        this.logger.log(`[valuation] Zillow success propertyId=${property.id}`);
      } catch (error) {
        this.logger.warn(
          `[valuation] Zillow failed propertyId=${property.id}: ${error}`,
        );
        // Fall through to fallback
      }
    }

    // Use fallback calculation if all APIs failed
    if (!result) {
      result = this.calculateFallbackValuation(property);
      this.logger.log(`[valuation] Using fallback for propertyId=${property.id}`);
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

  private async fetchGeminiValuation(property: {
    name: string;
    address?: string | null;
    country?: string | null;
    city?: string | null;
    size?: any;
    sizeUnit?: string | null;
    propertyType?: string | null;
  }): Promise<ValuationResult> {
    const countryName = COUNTRY_NAMES[property.country?.toUpperCase() || ''] || property.country;
    const propertyTypeName = PROPERTY_TYPE_NAMES[property.propertyType || 'OTHER'] || 'Property';
    const sizeValue = property.size ? Number(property.size) : null;
    const sizeUnit = property.sizeUnit === 'SQFT' ? 'square feet' : 'square meters';

    // Build property description for the prompt
    const propertyDetails: string[] = [];
    propertyDetails.push(`Type: ${propertyTypeName}`);
    if (sizeValue) {
      propertyDetails.push(`Size: ${sizeValue} ${sizeUnit}`);
    }
    if (property.city) {
      propertyDetails.push(`City: ${property.city}`);
    }
    propertyDetails.push(`Country: ${countryName}`);
    if (property.address) {
      propertyDetails.push(`Address: ${property.address}`);
    }

    const prompt = `You are a real estate valuation expert. Based on current market conditions and the property details below, estimate the market value of this property in USD.

Property Details:
${propertyDetails.join('\n')}

IMPORTANT: Respond with ONLY a JSON object in this exact format, no other text:
{"estimatedValue": <number>, "currency": "USD"}

The estimatedValue should be a realistic market value number (no commas, no currency symbols, just the number).
Consider local real estate market conditions, property type, size, and location when making your estimate.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the text response
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('No response from Gemini');
    }

    this.logger.log(`[valuation] Gemini raw response: ${textResponse}`);

    // Parse the JSON response
    // Try to extract JSON from the response (it might have markdown code blocks)
    let jsonStr = textResponse.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    let parsed: { estimatedValue: number; currency: string };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      // Try to extract number from response as fallback
      const numberMatch = textResponse.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/);
      if (numberMatch) {
        const value = parseFloat(numberMatch[1].replace(/,/g, ''));
        if (value > 0) {
          parsed = { estimatedValue: value, currency: 'USD' };
        } else {
          throw new Error(`Failed to parse Gemini response: ${textResponse}`);
        }
      } else {
        throw new Error(`Failed to parse Gemini response: ${textResponse}`);
      }
    }

    if (!parsed.estimatedValue || typeof parsed.estimatedValue !== 'number' || parsed.estimatedValue <= 0) {
      throw new Error(`Invalid estimated value from Gemini: ${parsed.estimatedValue}`);
    }

    return {
      estimatedValue: Math.round(parsed.estimatedValue),
      currency: parsed.currency || 'USD',
      source: 'gemini',
      lastUpdated: new Date(),
      confidence: 'high',
    };
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
    const countries: Array<{ code: string; name: string }> = Object.entries(COUNTRY_NAMES).map(
      ([code, name]) => ({ code, name }),
    );
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }
}
