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
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() createPropertyDto: CreatePropertyDto,
  ) {
    return this.propertiesService.create(user.sub, createPropertyDto);
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.propertiesService.findAllForUser(user.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.propertiesService.findOne(id, user.sub);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, user.sub, updatePropertyDto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.propertiesService.delete(id, user.sub);
    return { message: 'Property deleted successfully' };
  }
}
