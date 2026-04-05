import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PropertyValuationService, ValuationResult } from './property-valuation.service';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertyValuationController {
  constructor(private readonly valuationService: PropertyValuationService) {}

  @Get(':id/valuation')
  async getValuation(
    @Param('id') propertyId: string,
    @Req() req: any,
  ): Promise<ValuationResult> {
    return this.valuationService.getValuation(propertyId, req.user.id);
  }

  @Post(':id/valuation/refresh')
  async refreshValuation(
    @Param('id') propertyId: string,
    @Req() req: any,
  ): Promise<ValuationResult> {
    return this.valuationService.refreshValuation(propertyId, req.user.id);
  }

  @Get('valuation/countries')
  getAvailableCountries(): Array<{ code: string; name: string }> {
    return this.valuationService.getAvailableCountries();
  }
}
