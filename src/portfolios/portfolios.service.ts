import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { Permission } from '@prisma/client';

@Injectable()
export class PortfoliosService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePortfolioDto) {
    return this.prisma.portfolio.create({
      data: {
        ...dto,
        userId,
      },
      include: {
        assets: true,
        shares: {
          include: {
            sharedWithUser: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async findAllForUser(userId: string) {
    const ownedPortfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      include: {
        assets: true,
        shares: {
          where: { status: 'ACCEPTED' },
          include: {
            sharedWithUser: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sharedPortfolios = await this.prisma.portfolio.findMany({
      where: {
        shares: {
          some: {
            sharedWithUserId: userId,
            status: 'ACCEPTED',
          },
        },
      },
      include: {
        assets: true,
        shares: {
          where: { sharedWithUserId: userId, status: 'ACCEPTED' },
        },
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      owned: ownedPortfolios.map((p) => ({
        ...p,
        isOwner: true,
        totalValue: p.assets.reduce(
          (sum, asset) => sum + Number(asset.value),
          0,
        ),
      })),
      shared: sharedPortfolios.map((p) => ({
        ...p,
        isOwner: false,
        permission: p.shares[0]?.permission,
        totalValue: p.assets.reduce(
          (sum, asset) => sum + Number(asset.value),
          0,
        ),
      })),
    };
  }

  async findOne(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        assets: {
          orderBy: { createdAt: 'desc' },
        },
        shares: {
          include: {
            sharedWithUser: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
        user: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const isOwner = portfolio.userId === userId;
    const share = portfolio.shares.find((s) => s.sharedWithUserId === userId);

    if (!isOwner && !share) {
      throw new ForbiddenException('You do not have access to this portfolio');
    }

    if (!isOwner && share?.status !== 'ACCEPTED') {
      throw new ForbiddenException('You do not have access to this portfolio');
    }

    return {
      ...portfolio,
      isOwner,
      permission: isOwner ? Permission.EDIT : share?.permission,
      totalValue: portfolio.assets.reduce(
        (sum, asset) => sum + Number(asset.value),
        0,
      ),
    };
  }

  async update(id: string, userId: string, dto: UpdatePortfolioDto) {
    const portfolio = await this.findOne(id, userId);

    if (!portfolio.isOwner && portfolio.permission !== Permission.EDIT) {
      throw new ForbiddenException('You do not have permission to edit this portfolio');
    }

    return this.prisma.portfolio.update({
      where: { id },
      data: dto,
      include: {
        assets: true,
        shares: {
          include: {
            sharedWithUser: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== userId) {
      throw new ForbiddenException('Only the owner can delete this portfolio');
    }

    await this.prisma.portfolio.delete({ where: { id } });
  }

  async hasEditAccess(portfolioId: string, userId: string): Promise<boolean> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        shares: {
          where: { sharedWithUserId: userId, status: 'ACCEPTED' },
        },
      },
    });

    if (!portfolio) {
      return false;
    }

    if (portfolio.userId === userId) {
      return true;
    }

    const share = portfolio.shares[0];
    return share?.permission === Permission.EDIT;
  }

  async hasViewAccess(portfolioId: string, userId: string): Promise<boolean> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        shares: {
          where: { sharedWithUserId: userId, status: 'ACCEPTED' },
        },
      },
    });

    if (!portfolio) {
      return false;
    }

    if (portfolio.userId === userId) {
      return true;
    }

    return portfolio.shares.length > 0;
  }
}
