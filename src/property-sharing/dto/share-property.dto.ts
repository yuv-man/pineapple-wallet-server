import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Permission } from '@prisma/client';

export class SharePropertyDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(Permission)
  permission?: Permission = Permission.VIEW;
}
