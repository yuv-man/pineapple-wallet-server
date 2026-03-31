import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Permission, TransactionType } from '@prisma/client';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        ...dto,
        userId,
      },
      include: {
        transactions: {
          include: {
            category: true,
          },
        },
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
    const ownedProperties = await this.prisma.property.findMany({
      where: { userId },
      include: {
        transactions: true,
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

    const sharedProperties = await this.prisma.property.findMany({
      where: {
        shares: {
          some: {
            sharedWithUserId: userId,
            status: 'ACCEPTED',
          },
        },
      },
      include: {
        transactions: true,
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
      owned: ownedProperties.map((p) => ({
        ...p,
        isOwner: true,
        ...this.calculateBalance(p.transactions),
      })),
      shared: sharedProperties.map((p) => ({
        ...p,
        isOwner: false,
        permission: p.shares[0]?.permission,
        ...this.calculateBalance(p.transactions),
      })),
    };
  }

  async findOne(id: string, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        transactions: {
          include: {
            category: true,
          },
          orderBy: { date: 'desc' },
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

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const isOwner = property.userId === userId;
    const share = property.shares.find((s) => s.sharedWithUserId === userId);

    if (!isOwner && !share) {
      throw new ForbiddenException('You do not have access to this property');
    }

    if (!isOwner && share?.status !== 'ACCEPTED') {
      throw new ForbiddenException('You do not have access to this property');
    }

    return {
      ...property,
      isOwner,
      permission: isOwner ? Permission.EDIT : share?.permission,
      ...this.calculateBalance(property.transactions),
    };
  }

  async update(id: string, userId: string, dto: UpdatePropertyDto) {
    const property = await this.findOne(id, userId);

    if (!property.isOwner && property.permission !== Permission.EDIT) {
      throw new ForbiddenException(
        'You do not have permission to edit this property',
      );
    }

    return this.prisma.property.update({
      where: { id },
      data: dto,
      include: {
        transactions: {
          include: {
            category: true,
          },
        },
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
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.userId !== userId) {
      throw new ForbiddenException('Only the owner can delete this property');
    }

    await this.prisma.property.delete({ where: { id } });
  }

  async hasEditAccess(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        shares: {
          where: { sharedWithUserId: userId, status: 'ACCEPTED' },
        },
      },
    });

    if (!property) {
      return false;
    }

    if (property.userId === userId) {
      return true;
    }

    const share = property.shares[0];
    return share?.permission === Permission.EDIT;
  }

  async hasViewAccess(propertyId: string, userId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        shares: {
          where: { sharedWithUserId: userId, status: 'ACCEPTED' },
        },
      },
    });

    if (!property) {
      return false;
    }

    if (property.userId === userId) {
      return true;
    }

    return property.shares.length > 0;
  }

  private calculateBalance(transactions: { type: TransactionType; amount: any }[]) {
    const totalProfit = transactions
      .filter((t) => t.type === TransactionType.PROFIT)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      totalProfit,
      totalExpenses,
      netBalance: totalProfit - totalExpenses,
    };
  }
}
