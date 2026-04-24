import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLiabilityDto } from './dto/create-liability.dto';
import { UpdateLiabilityDto } from './dto/update-liability.dto';

@Injectable()
export class LiabilitiesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateLiabilityDto) {
    const liability = await this.prisma.liability.create({
      data: {
        userId,
        type: dto.type,
        name: dto.name,
        balance: new Decimal(dto.balance),
        currency: dto.currency || 'USD',
        interestRate: dto.interestRate != null ? new Decimal(dto.interestRate) : undefined,
        minimumPayment: dto.minimumPayment != null ? new Decimal(dto.minimumPayment) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        details: dto.details || {},
      },
    });

    await this.prisma.liabilityBalanceHistory.create({
      data: {
        liabilityId: liability.id,
        balance: new Decimal(dto.balance),
      },
    });

    return liability;
  }

  async findAllForUser(userId: string) {
    return this.prisma.liability.findMany({
      where: { userId },
      include: {
        balanceHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const liability = await this.prisma.liability.findUnique({
      where: { id },
      include: {
        balanceHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!liability) {
      throw new NotFoundException('Liability not found');
    }

    if (liability.userId !== userId) {
      throw new ForbiddenException('You do not have access to this liability');
    }

    return liability;
  }

  async update(id: string, userId: string, dto: UpdateLiabilityDto) {
    const liability = await this.prisma.liability.findUnique({ where: { id } });

    if (!liability) {
      throw new NotFoundException('Liability not found');
    }

    if (liability.userId !== userId) {
      throw new ForbiddenException('You do not have access to this liability');
    }

    const updated = await this.prisma.liability.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.name && { name: dto.name }),
        ...(dto.balance != null && { balance: new Decimal(dto.balance) }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.interestRate != null && { interestRate: new Decimal(dto.interestRate) }),
        ...(dto.minimumPayment != null && { minimumPayment: new Decimal(dto.minimumPayment) }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.details !== undefined && { details: dto.details }),
      },
    });

    if (dto.balance != null && !new Decimal(dto.balance).equals(liability.balance)) {
      await this.prisma.liabilityBalanceHistory.create({
        data: {
          liabilityId: id,
          balance: new Decimal(dto.balance),
        },
      });
    }

    return updated;
  }

  async delete(id: string, userId: string) {
    const liability = await this.prisma.liability.findUnique({ where: { id } });

    if (!liability) {
      throw new NotFoundException('Liability not found');
    }

    if (liability.userId !== userId) {
      throw new ForbiddenException('You do not have access to this liability');
    }

    await this.prisma.liability.delete({ where: { id } });
  }
}
