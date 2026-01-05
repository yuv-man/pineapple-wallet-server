import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    const fullUser = await this.usersService.findById(user.sub);
    if (!fullUser) {
      return null;
    }
    const { password, ...result } = fullUser;
    return result;
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    const updated = await this.usersService.update(user.sub, updateUserDto);
    const { password, ...result } = updated;
    return result;
  }

  @Delete('me')
  async deleteMe(@CurrentUser() user: any) {
    await this.usersService.delete(user.sub);
    return { message: 'Account deleted successfully' };
  }

  @Get('search')
  async searchUsers(@CurrentUser() user: any, @Query('email') email: string) {
    if (!email || email.length < 2) {
      return [];
    }
    return this.usersService.searchByEmail(email, user.sub);
  }
}
