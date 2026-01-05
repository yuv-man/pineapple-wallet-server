import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: {
    email: string;
    password?: string;
    name: string;
    avatar?: string;
    provider?: string;
    providerId?: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  async searchByEmail(
    email: string,
    excludeUserId: string,
  ): Promise<
    Prisma.UserGetPayload<{
      select: {
        id: true;
        email: true;
        name: true;
        avatar: true;
        createdAt: true;
        updatedAt: true;
        provider: true;
      };
    }>[]
  > {
    return this.prisma.user.findMany({
      where: {
        email: { contains: email, mode: 'insensitive' },
        id: { not: excludeUserId },
      },
      take: 10,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        provider: true,
      },
    });
  }
}
