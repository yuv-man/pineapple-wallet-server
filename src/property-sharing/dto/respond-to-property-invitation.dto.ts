import { IsBoolean } from 'class-validator';

export class RespondToPropertyInvitationDto {
  @IsBoolean()
  accept: boolean;
}
