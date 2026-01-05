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
import { SharingService } from './sharing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SharePortfolioDto } from './dto/share-portfolio.dto';
import { UpdateShareDto } from './dto/update-share.dto';
import { RespondToInvitationDto } from './dto/respond-to-invitation.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class SharingController {
  constructor(private sharingService: SharingService) {}

  @Post('portfolios/:portfolioId/share')
  async sharePortfolio(
    @CurrentUser() user: any,
    @Param('portfolioId') portfolioId: string,
    @Body() sharePortfolioDto: SharePortfolioDto,
  ) {
    return this.sharingService.sharePortfolio(
      portfolioId,
      user.sub,
      sharePortfolioDto,
    );
  }

  @Get('portfolios/:portfolioId/shares')
  async getSharesForPortfolio(
    @CurrentUser() user: any,
    @Param('portfolioId') portfolioId: string,
  ) {
    return this.sharingService.getSharesForPortfolio(portfolioId, user.sub);
  }

  @Get('invitations')
  async getPendingInvitations(@CurrentUser() user: any) {
    return this.sharingService.getPendingInvitations(user.sub);
  }

  @Patch('invitations/:id')
  async respondToInvitation(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RespondToInvitationDto,
  ) {
    return this.sharingService.respondToInvitation(id, user.sub, dto.accept);
  }

  @Patch('shares/:id')
  async updateShare(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateShareDto: UpdateShareDto,
  ) {
    return this.sharingService.updateShare(id, user.sub, updateShareDto);
  }

  @Delete('shares/:id')
  async revokeShare(@CurrentUser() user: any, @Param('id') id: string) {
    await this.sharingService.revokeShare(id, user.sub);
    return { message: 'Share revoked successfully' };
  }

  @Get('shared-with-me')
  async getSharedWithMe(@CurrentUser() user: any) {
    return this.sharingService.getSharedWithMe(user.sub);
  }
}
