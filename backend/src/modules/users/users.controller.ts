import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, ChangeStatusDto, ListUsersQueryDto } from './dto/user.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/roles.constant.js';

@ApiTags('Admin - Users Management')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (Admin) kèm phân loại chính thức / test' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'classification', required: false, description: 'all | official | test' })
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query, query.search, query.role, query.status, query.classification);
  }

  @Post('cleanup-test-data')
  @ApiOperation({ summary: 'Dọn dẹp toàn bộ tài khoản kiểm thử và dữ liệu rác (1-Click Clean)' })
  async cleanupTestData() {
    return this.usersService.cleanupTestData();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo tài khoản nhân viên / người dùng mới (Admin)' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết người dùng' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Thay đổi vai trò người dùng' })
  async changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.usersService.changeRole(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Khóa / Mở khóa tài khoản người dùng' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.usersService.changeStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa tài khoản người dùng hoặc tài khoản rác' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
