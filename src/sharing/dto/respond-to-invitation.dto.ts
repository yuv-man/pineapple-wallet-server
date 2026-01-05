import { IsBoolean } from 'class-validator';

export class RespondToInvitationDto {
  @IsBoolean()
  accept: boolean;
}
