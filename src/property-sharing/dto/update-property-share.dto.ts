import { IsEnum } from 'class-validator';
import { Permission } from '@prisma/client';

export class UpdatePropertyShareDto {
  @IsEnum(Permission)
  permission: Permission;
}
