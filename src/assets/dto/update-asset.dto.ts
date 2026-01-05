import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

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
