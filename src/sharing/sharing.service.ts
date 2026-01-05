import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SharePortfolioDto } from './dto/share-portfolio.dto';
import { UpdateShareDto } from './dto/update-share.dto';
import { ShareStatus } from '@prisma/client';

@Injectable()
export class SharingService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async sharePortfolio(
    portfolioId: string,
    ownerId: string,
    dto: SharePortfolioDto,
  ) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== ownerId) {
      throw new ForbiddenException('Only the owner can share this portfolio');
    }

    const userToShareWith = await this.usersService.findByEmail(dto.email);
    if (!userToShareWith) {
      throw new NotFoundException('User with this email not found');
    }

    if (userToShareWith.id === ownerId) {
      throw new BadRequestException('You cannot share a portfolio with yourself');
    }

    const existingShare = await this.prisma.portfolioShare.findUnique({
      where: {
        portfolioId_sharedWithUserId: {
          portfolioId,
          sharedWithUserId: userToShareWith.id,
        },
      },
    });

    if (existingShare) {
      throw new ConflictException('Portfolio is already shared with this user');
    }

    return this.prisma.portfolioShare.create({
      data: {
        portfolioId,
        sharedWithUserId: userToShareWith.id,
        permission: dto.permission,
      },
      include: {
        sharedWithUser: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        portfolio: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getSharesForPortfolio(portfolioId: string, userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    if (portfolio.userId !== userId) {
      throw new ForbiddenException('Only the owner can view shares');
    }

    return this.prisma.portfolioShare.findMany({
      where: { portfolioId },
      include: {
        sharedWithUser: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingInvitations(userId: string) {
    return this.prisma.portfolioShare.findMany({
      where: {
        sharedWithUserId: userId,
        status: ShareStatus.PENDING,
      },
      include: {
        portfolio: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondToInvitation(shareId: string, userId: string, accept: boolean) {
    const share = await this.prisma.portfolioShare.findUnique({
      where: { id: shareId },
      include: {
        portfolio: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Invitation not found');
    }

    if (share.sharedWithUserId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (share.status !== ShareStatus.PENDING) {
      throw new BadRequestException('This invitation has already been responded to');
    }

    return this.prisma.portfolioShare.update({
      where: { id: shareId },
      data: {
        status: accept ? ShareStatus.ACCEPTED : ShareStatus.DECLINED,
      },
      include: {
        portfolio: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async updateShare(shareId: string, ownerId: string, dto: UpdateShareDto) {
    const share = await this.prisma.portfolioShare.findUnique({
      where: { id: shareId },
      include: {
        portfolio: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.portfolio.userId !== ownerId) {
      throw new ForbiddenException('Only the owner can update share permissions');
    }

    return this.prisma.portfolioShare.update({
      where: { id: shareId },
      data: {
        permission: dto.permission,
      },
      include: {
        sharedWithUser: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
    });
  }

  async revokeShare(shareId: string, userId: string) {
    const share = await this.prisma.portfolioShare.findUnique({
      where: { id: shareId },
      include: {
        portfolio: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    // Allow owner to revoke or the shared user to leave
    if (share.portfolio.userId !== userId && share.sharedWithUserId !== userId) {
      throw new ForbiddenException('You cannot revoke this share');
    }

    await this.prisma.portfolioShare.delete({ where: { id: shareId } });
  }

  async getSharedWithMe(userId: string) {
    return this.prisma.portfolioShare.findMany({
      where: {
        sharedWithUserId: userId,
        status: ShareStatus.ACCEPTED,
      },
      include: {
        portfolio: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
            assets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
