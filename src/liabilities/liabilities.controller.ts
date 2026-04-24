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
import { LiabilitiesService } from './liabilities.service';
import { CreateLiabilityDto } from './dto/create-liability.dto';
import { UpdateLiabilityDto } from './dto/update-liability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('liabilities')
@UseGuards(JwtAuthGuard)
export class LiabilitiesController {
  constructor(private liabilitiesService: LiabilitiesService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateLiabilityDto) {
    return this.liabilitiesService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.liabilitiesService.findAllForUser(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.liabilitiesService.findOne(id, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateLiabilityDto,
  ) {
    return this.liabilitiesService.update(id, user.sub, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.liabilitiesService.delete(id, user.sub);
    return { message: 'Liability deleted successfully' };
  }
}
