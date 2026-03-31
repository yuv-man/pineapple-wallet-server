import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreatePropertyTransactionDto } from './dto/create-property-transaction.dto';
import { UpdatePropertyTransactionDto } from './dto/update-property-transaction.dto';

@Injectable()
export class PropertyTransactionsService {
  constructor(
    private prisma: PrismaService,
    private propertiesService: PropertiesService,
  ) {}

  async create(
    propertyId: string,
    userId: string,
    dto: CreatePropertyTransactionDto,
  ) {
    const hasAccess = await this.propertiesService.hasEditAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to add transactions to this property',
      );
    }

    return this.prisma.propertyTransaction.create({
      data: {
        propertyId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency || 'USD',
        date: new Date(dto.date),
        description: dto.description,
      },
      include: {
        category: true,
      },
    });
  }

  async findAllForProperty(propertyId: string, userId: string) {
    const hasAccess = await this.propertiesService.hasViewAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this property',
      );
    }

    return this.prisma.propertyTransaction.findMany({
      where: { propertyId },
      include: {
        category: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.propertyTransaction.findUnique({
      where: { id },
      include: {
        category: true,
        property: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const hasAccess = await this.propertiesService.hasViewAccess(
      transaction.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this transaction',
      );
    }

    return transaction;
  }

  async update(id: string, userId: string, dto: UpdatePropertyTransactionDto) {
    const transaction = await this.prisma.propertyTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const hasAccess = await this.propertiesService.hasEditAccess(
      transaction.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to edit this transaction',
      );
    }

    return this.prisma.propertyTransaction.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
      include: {
        category: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    const transaction = await this.prisma.propertyTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const hasAccess = await this.propertiesService.hasEditAccess(
      transaction.propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have permission to delete this transaction',
      );
    }

    await this.prisma.propertyTransaction.delete({ where: { id } });
  }

  async getSummary(propertyId: string, userId: string) {
    const hasAccess = await this.propertiesService.hasViewAccess(
      propertyId,
      userId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this property',
      );
    }

    const transactions = await this.prisma.propertyTransaction.findMany({
      where: { propertyId },
      include: {
        category: true,
      },
    });

    const byCategory = transactions.reduce(
      (acc, t) => {
        const key = t.category.name;
        if (!acc[key]) {
          acc[key] = { name: key, type: t.type, total: 0 };
        }
        acc[key].total += Number(t.amount);
        return acc;
      },
      {} as Record<string, { name: string; type: string; total: number }>,
    );

    const totalProfit = transactions
      .filter((t) => t.type === 'PROFIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      byCategory: Object.values(byCategory),
      totalProfit,
      totalExpenses,
      netBalance: totalProfit - totalExpenses,
    };
  }
}
