import {
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { LiabilityType } from '@prisma/client';

export class UpdateLiabilityDto {
  @IsOptional()
  @IsEnum(LiabilityType)
  type?: LiabilityType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumPayment?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
