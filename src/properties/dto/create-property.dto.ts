import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PropertyType {
  APARTMENT = 'APARTMENT',
  HOUSE = 'HOUSE',
  LAND = 'LAND',
  COMMERCIAL = 'COMMERCIAL',
  OTHER = 'OTHER',
}

export enum SizeUnit {
  SQM = 'SQM',
  SQFT = 'SQFT',
}

export class CreatePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsEnum(SizeUnit)
  sizeUnit?: SizeUnit;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
