import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SharePropertyDto } from './dto/share-property.dto';
import { UpdatePropertyShareDto } from './dto/update-property-share.dto';
import { ShareStatus } from '@prisma/client';

@Injectable()
export class PropertySharingService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async shareProperty(
    propertyId: string,
    ownerId: string,
    dto: SharePropertyDto,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.userId !== ownerId) {
      throw new ForbiddenException('Only the owner can share this property');
    }

    const userToShareWith = await this.usersService.findByEmail(dto.email);
    if (!userToShareWith) {
      throw new NotFoundException('User with this email not found');
    }

    if (userToShareWith.id === ownerId) {
      throw new BadRequestException('You cannot share a property with yourself');
    }

    const existingShare = await this.prisma.propertyShare.findUnique({
      where: {
        propertyId_sharedWithUserId: {
          propertyId,
          sharedWithUserId: userToShareWith.id,
        },
      },
    });

    if (existingShare) {
      throw new ConflictException('Property is already shared with this user');
    }

    return this.prisma.propertyShare.create({
      data: {
        propertyId,
        sharedWithUserId: userToShareWith.id,
        permission: dto.permission,
      },
      include: {
        sharedWithUser: {
          select: { id: true, email: true, name: true, avatar: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getSharesForProperty(propertyId: string, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.userId !== userId) {
      throw new ForbiddenException('Only the owner can view shares');
    }

    return this.prisma.propertyShare.findMany({
      where: { propertyId },
      include: {
        sharedWithUser: {
          select: { id: true, email: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingPropertyInvitations(userId: string) {
    return this.prisma.propertyShare.findMany({
      where: {
        sharedWithUserId: userId,
        status: ShareStatus.PENDING,
      },
      include: {
        property: {
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

  async respondToPropertyInvitation(
    shareId: string,
    userId: string,
    accept: boolean,
  ) {
    const share = await this.prisma.propertyShare.findUnique({
      where: { id: shareId },
      include: {
        property: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Invitation not found');
    }

    if (share.sharedWithUserId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (share.status !== ShareStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has already been responded to',
      );
    }

    return this.prisma.propertyShare.update({
      where: { id: shareId },
      data: {
        status: accept ? ShareStatus.ACCEPTED : ShareStatus.DECLINED,
      },
      include: {
        property: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
          },
        },
      },
    });
  }

  async updatePropertyShare(
    shareId: string,
    ownerId: string,
    dto: UpdatePropertyShareDto,
  ) {
    const share = await this.prisma.propertyShare.findUnique({
      where: { id: shareId },
      include: {
        property: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    if (share.property.userId !== ownerId) {
      throw new ForbiddenException(
        'Only the owner can update share permissions',
      );
    }

    return this.prisma.propertyShare.update({
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

  async revokePropertyShare(shareId: string, userId: string) {
    const share = await this.prisma.propertyShare.findUnique({
      where: { id: shareId },
      include: {
        property: true,
      },
    });

    if (!share) {
      throw new NotFoundException('Share not found');
    }

    // Allow owner to revoke or the shared user to leave
    if (
      share.property.userId !== userId &&
      share.sharedWithUserId !== userId
    ) {
      throw new ForbiddenException('You cannot revoke this share');
    }

    await this.prisma.propertyShare.delete({ where: { id: shareId } });
  }

  async getPropertiesSharedWithMe(userId: string) {
    return this.prisma.propertyShare.findMany({
      where: {
        sharedWithUserId: userId,
        status: ShareStatus.ACCEPTED,
      },
      include: {
        property: {
          include: {
            user: {
              select: { id: true, email: true, name: true, avatar: true },
            },
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
