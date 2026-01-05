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
import { PortfoliosService } from './portfolios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfoliosController {
  constructor(private portfoliosService: PortfoliosService) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createPortfolioDto: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create(user.sub, createPortfolioDto);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.portfoliosService.findAllForUser(user.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.portfoliosService.findOne(id, user.sub);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updatePortfolioDto: UpdatePortfolioDto,
  ) {
    return this.portfoliosService.update(id, user.sub, updatePortfolioDto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.portfoliosService.delete(id, user.sub);
    return { message: 'Portfolio deleted successfully' };
  }
}
