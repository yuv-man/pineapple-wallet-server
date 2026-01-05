import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export enum AssetType {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  REAL_ESTATE = 'REAL_ESTATE',
  CRYPTO = 'CRYPTO',
  STOCK = 'STOCK',
  INVESTMENT = 'INVESTMENT',
}

export class CreateAssetDto {
  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
