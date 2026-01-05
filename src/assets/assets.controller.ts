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
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Post('portfolios/:portfolioId/assets')
  async create(
    @CurrentUser() user: any,
    @Param('portfolioId') portfolioId: string,
    @Body() createAssetDto: CreateAssetDto,
  ) {
    return this.assetsService.create(portfolioId, user.sub, createAssetDto);
  }

  @Get('portfolios/:portfolioId/assets')
  async findAllForPortfolio(
    @CurrentUser() user: any,
    @Param('portfolioId') portfolioId: string,
  ) {
    return this.assetsService.findAllForPortfolio(portfolioId, user.sub);
  }

  @Get('portfolios/:portfolioId/assets/by-type')
  async getAssetsByType(
    @CurrentUser() user: any,
    @Param('portfolioId') portfolioId: string,
  ) {
    return this.assetsService.getAssetsByType(portfolioId, user.sub);
  }

  @Get('assets/:id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.assetsService.findOne(id, user.sub);
  }

  @Patch('assets/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return this.assetsService.update(id, user.sub, updateAssetDto);
  }

  @Delete('assets/:id')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.assetsService.delete(id, user.sub);
    return { message: 'Asset deleted successfully' };
  }
}
