import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreatePropertyCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;
}
