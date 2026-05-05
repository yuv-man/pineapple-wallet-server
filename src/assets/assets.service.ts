import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    private portfoliosService: PortfoliosService,
  ) {}

  async create(portfolioId: string, userId: string, dto: CreateAssetDto) {
    const hasAccess = await this.portfoliosService.hasEditAccess(portfolioId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to add assets to this portfolio');
    }

    const asset = await this.prisma.asset.create({
      data: {
        portfolioId,
        type: dto.type,
        name: dto.name,
        value: new Decimal(dto.value),
        currency: dto.currency || 'USD',
        notes: dto.notes,
        details: dto.details || {},
        addedByUserId: userId,
      },
    });

    // Create initial value history entry
    await this.prisma.assetValueHistory.create({
      data: {
        assetId: asset.id,
        value: new Decimal(dto.value),
      },
    });

    return asset;
  }

  async findAllForPortfolio(portfolioId: string, userId: string) {
    const hasAccess = await this.portfoliosService.hasViewAccess(portfolioId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this portfolio');
    }

    return this.prisma.asset.findMany({
      where: { portfolioId },
      include: {
        valueHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
        addedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        portfolio: true,
        valueHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 30,
        },
        addedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const hasAccess = await this.portfoliosService.hasViewAccess(
      asset.portfolioId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this asset');
    }

    return asset;
  }

  async update(id: string, userId: string, dto: UpdateAssetDto) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const hasAccess = await this.portfoliosService.hasEditAccess(
      asset.portfolioId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to edit this asset');
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id },
      data: {
        name: dto.name,
        value: dto.value ? new Decimal(dto.value) : undefined,
        currency: dto.currency,
        notes: dto.notes,
        details: dto.details,
        addedByUserId: dto.addedByUserId,
      },
      include: {
        addedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // If value changed, record in history
    if (dto.value && Number(dto.value) !== Number(asset.value)) {
      await this.prisma.assetValueHistory.create({
        data: {
          assetId: asset.id,
          value: new Decimal(dto.value),
        },
      });
    }

    return updatedAsset;
  }

  async delete(id: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const hasAccess = await this.portfoliosService.hasEditAccess(
      asset.portfolioId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to delete this asset');
    }

    await this.prisma.asset.delete({ where: { id } });
  }

  async getAssetsByType(portfolioId: string, userId: string) {
    const hasAccess = await this.portfoliosService.hasViewAccess(portfolioId, userId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this portfolio');
    }

    const assets = await this.prisma.asset.findMany({
      where: { portfolioId },
    });

    const grouped = assets.reduce(
      (acc, asset) => {
        if (!acc[asset.type]) {
          acc[asset.type] = { count: 0, totalValue: 0 };
        }
        acc[asset.type].count += 1;
        acc[asset.type].totalValue += Number(asset.value);
        return acc;
      },
      {} as Record<string, { count: number; totalValue: number }>,
    );

    return grouped;
  }
}
