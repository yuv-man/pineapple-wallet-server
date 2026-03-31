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
import { PropertyTransactionsService } from './property-transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePropertyTransactionDto } from './dto/create-property-transaction.dto';
import { UpdatePropertyTransactionDto } from './dto/update-property-transaction.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class PropertyTransactionsController {
  constructor(
    private propertyTransactionsService: PropertyTransactionsService,
  ) {}

  @Post('properties/:propertyId/transactions')
  async create(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreatePropertyTransactionDto,
  ) {
    return this.propertyTransactionsService.create(propertyId, user.sub, dto);
  }

  @Get('properties/:propertyId/transactions')
  async findAllForProperty(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertyTransactionsService.findAllForProperty(
      propertyId,
      user.sub,
    );
  }

  @Get('properties/:propertyId/transactions/summary')
  async getSummary(
    @CurrentUser() user: any,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertyTransactionsService.getSummary(propertyId, user.sub);
  }

  @Get('property-transactions/:id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.propertyTransactionsService.findOne(id, user.sub);
  }

  @Patch('property-transactions/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyTransactionDto,
  ) {
    return this.propertyTransactionsService.update(id, user.sub, dto);
  }

  @Delete('property-transactions/:id')
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.propertyTransactionsService.delete(id, user.sub);
    return { message: 'Transaction deleted successfully' };
  }
}
