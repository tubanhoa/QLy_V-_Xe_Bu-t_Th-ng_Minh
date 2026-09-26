import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { CreateUserDto, UpdateUserDto, ChangeRoleDto, ChangeStatusDto } from './dto/user.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { Role } from '../../common/constants/roles.constant.js';
import { UserStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findAll(pagination: PaginationDto, search?: string, role?: string, status?: string) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.phoneNumber',
        'user.avatarUrl',
        'user.studentId',
        'user.faculty',
        'user.idCardNumber',
        'user.status',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
      ]);

    if (search) {
      query.andWhere(
        '(LOWER(user.fullName) LIKE :search OR LOWER(user.email) LIKE :search OR user.phoneNumber LIKE :search OR user.studentId LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (role) {
      query.andWhere('role.name = :role', { role });
    }

    if (status) {
      query.andWhere('user.status = :status', { status });
    }

    query.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID ${id}`);
    }

    const { passwordHash, refreshTokenHash, ...result } = user;
    return result;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email này đã tồn tại trong hệ thống');
    }

    let role = await this.roleRepository.findOne({
      where: { name: dto.role },
    });

    if (!role) {
      role = this.roleRepository.create({
        name: dto.role,
        description: `Vai trò ${dto.role}`,
      });
      await this.roleRepository.save(role);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phoneNumber: dto.phoneNumber,
      passwordHash,
      roleId: role.id,
      studentId: dto.studentId,
      faculty: dto.faculty,
      idCardNumber: dto.idCardNumber,
      status: UserStatus.ACTIVE,
    });

    const saved = await this.userRepository.save(user);
    const { passwordHash: _, refreshTokenHash: __, ...result } = saved;
    return { ...result, role: role.name };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);

    await this.userRepository.update(id, {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.studentId !== undefined && { studentId: dto.studentId }),
      ...(dto.faculty !== undefined && { faculty: dto.faculty }),
      ...(dto.idCardNumber !== undefined && { idCardNumber: dto.idCardNumber }),
    });

    return this.findById(id);
  }

  async changeRole(id: string, dto: ChangeRoleDto) {
    const user = await this.findById(id);

    const role = await this.roleRepository.findOne({
      where: { name: dto.role },
    });

    if (!role) {
      throw new BadRequestException(`Vai trò ${dto.role} không tồn tại`);
    }

    await this.userRepository.update(id, { roleId: role.id });
    return this.findById(id);
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    await this.findById(id);
    await this.userRepository.update(id, { status: dto.status });
    return this.findById(id);
  }
}
