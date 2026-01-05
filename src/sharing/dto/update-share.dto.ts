import { IsEnum } from 'class-validator';

export enum Permission {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

export class UpdateShareDto {
  @IsEnum(Permission)
  permission: Permission;
}
