import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyCategoryDto } from './dto/create-property-category.dto';

@Injectable()
export class PropertyCategoriesService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string) {
    // Get system categories and user's custom categories
    const categories = await this.prisma.propertyCategory.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return categories;
  }

  async create(userId: string, dto: CreatePropertyCategoryDto) {
    // Check if category with same name and type already exists for this user
    const existing = await this.prisma.propertyCategory.findFirst({
      where: {
        name: dto.name,
        type: dto.type,
        OR: [{ isSystem: true }, { userId }],
      },
    });

    if (existing) {
      throw new ConflictException(
        'A category with this name already exists',
      );
    }

    return this.prisma.propertyCategory.create({
      data: {
        name: dto.name,
        type: dto.type,
        isSystem: false,
        userId,
      },
    });
  }

  async delete(id: string, userId: string) {
    const category = await this.prisma.propertyCategory.findUnique({
      where: { id },
    });

    if (!category) {
      return;
    }

    if (category.isSystem) {
      throw new ForbiddenException('Cannot delete system categories');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own custom categories',
      );
    }

    // Check if category is in use
    const transactionsCount = await this.prisma.propertyTransaction.count({
      where: { categoryId: id },
    });

    if (transactionsCount > 0) {
      throw new ForbiddenException(
        'Cannot delete category that is in use by transactions',
      );
    }

    await this.prisma.propertyCategory.delete({ where: { id } });
  }
}
