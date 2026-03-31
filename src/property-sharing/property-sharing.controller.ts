import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PropertySharingService } from './property-sharing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SharePropertyDto } from './dto/share-property.dto';
import { UpdatePropertyShareDto } from './dto/update-property-share.dto';
import { RespondToPropertyInvitationDto } from './dto/respond-to-property-invitation.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PropertySharingController {
  constructor(private propertySharingService: PropertySharingService) {}

  @Post('properties/:propertyId/share')
  async shareProperty(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
    @Body() dto: SharePropertyDto,
  ) {
    return this.propertySharingService.shareProperty(
      propertyId,
      user.sub,
      dto,
    );
  }

  @Get('properties/:propertyId/shares')
  async getSharesForProperty(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertySharingService.getSharesForProperty(
      propertyId,
      user.sub,
    );
  }

  @Get('property-invitations')
  async getPendingPropertyInvitations(@CurrentUser() user: any) {
    return this.propertySharingService.getPendingPropertyInvitations(user.sub);
  }

  @Patch('property-invitations/:id')
  async respondToPropertyInvitation(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RespondToPropertyInvitationDto,
  ) {
    return this.propertySharingService.respondToPropertyInvitation(
      id,
      user.sub,
      dto.accept,
    );
  }

  @Patch('property-shares/:id')
  async updatePropertyShare(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyShareDto,
  ) {
    return this.propertySharingService.updatePropertyShare(
      id,
      user.sub,
      dto,
    );
  }

  @Delete('property-shares/:id')
  async revokePropertyShare(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.propertySharingService.revokePropertyShare(id, user.sub);
    return { message: 'Share revoked successfully' };
  }

  @Get('properties-shared-with-me')
  async getPropertiesSharedWithMe(@CurrentUser() user: any) {
    return this.propertySharingService.getPropertiesSharedWithMe(user.sub);
  }
}
