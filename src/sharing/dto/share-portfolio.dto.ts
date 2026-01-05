import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export enum Permission {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

export class SharePortfolioDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(Permission)
  permission?: Permission = Permission.VIEW;
}
