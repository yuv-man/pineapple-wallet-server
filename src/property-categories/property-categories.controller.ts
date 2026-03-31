import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PropertyCategoriesService } from './property-categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePropertyCategoryDto } from './dto/create-property-category.dto';

@Controller('property-categories')
@UseGuards(JwtAuthGuard)
export class PropertyCategoriesController {
  constructor(
    private propertyCategoriesService: PropertyCategoriesService,
  ) {}

  @Get()
  async getAll(@CurrentUser() user: any) {
    return this.propertyCategoriesService.getAll(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreatePropertyCategoryDto,
  ) {
    return this.propertyCategoriesService.create(user.sub, dto);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.propertyCategoriesService.delete(id, user.sub);
    return { message: 'Category deleted successfully' };
  }
}
