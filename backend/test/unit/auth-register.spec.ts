import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { UserEntity } from '../../src/database/entities/user.entity.js';
import { RoleEntity } from '../../src/database/entities/role.entity.js';
import { UserStatus } from '../../src/common/constants/status.constant.js';
import { Role } from '../../src/common/constants/roles.constant.js';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';

describe('AuthService - Unit Tests', () => {
  let service: AuthService;
  let userRepository: any;
  let roleRepository: any;
  let jwtService: any;

  const mockPassengerRole: Partial<RoleEntity> = {
    id: 'role-uuid-passenger',
    name: Role.PASSENGER,
    description: 'Hành khách',
  };

  const mockUser: Partial<UserEntity> = {
    id: 'user-uuid-1',
    email: 'test@ictu.edu.vn',
    fullName: 'Nguyễn Văn Test',
    passwordHash: '$2b$10$hashedpassword',
    roleId: 'role-uuid-passenger',
    role: mockPassengerRole as RoleEntity,
    status: UserStatus.ACTIVE,
    studentId: 'DTC215180001',
    phoneNumber: '0987654321',
    refreshTokenHash: null as any,
  };

  beforeEach(async () => {
    userRepository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({}),
      }),
    };

    roleRepository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    jwtService = {
      signAsync: vi.fn(),
      verify: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: getRepositoryToken(RoleEntity), useValue: roleRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ========================================
  // REGISTER TESTS
  // ========================================
  describe('register()', () => {
    const validRegisterDto = {
      email: 'newuser@ictu.edu.vn',
      password: 'Password@123',
      fullName: 'Nguyễn Văn Mới',
      phoneNumber: '0987654321',
      studentId: 'DTC215180099',
      faculty: 'Công Nghệ Thông Tin',
      idCardNumber: '012345678901',
    };

    it('should register successfully with valid data', async () => {
      // No existing user
      userRepository.findOne.mockResolvedValue(null);
      // Role exists
      roleRepository.findOne.mockResolvedValue(mockPassengerRole);
      // Create and save user
      const savedUser = {
        ...mockUser,
        id: 'new-user-uuid',
        email: validRegisterDto.email,
        fullName: validRegisterDto.fullName,
      };
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);
      // JWT tokens
      jwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-456');

      const result = await service.register(validRegisterDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result.user.email).toBe(validRegisterDto.email);
      expect(result.user.fullName).toBe(validRegisterDto.fullName);
      expect(result.user.role).toBe(Role.PASSENGER);
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(validRegisterDto)).rejects.toThrow(ConflictException);
      await expect(service.register(validRegisterDto)).rejects.toThrow(
        'Email này đã được đăng ký trong hệ thống',
      );
    });

    it('should auto-create PASSENGER role if not exists', async () => {
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(null); // Role doesn't exist
      roleRepository.create.mockReturnValue(mockPassengerRole);
      roleRepository.save.mockResolvedValue(mockPassengerRole);

      const savedUser = { ...mockUser, id: 'new-user-uuid' };
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register(validRegisterDto);

      expect(roleRepository.create).toHaveBeenCalledWith({
        name: Role.PASSENGER,
        description: 'Hành khách',
      });
      expect(roleRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('user');
    });

    it('should lowercase email before saving', async () => {
      const dtoUpperEmail = { ...validRegisterDto, email: 'TEST@ICTU.EDU.VN' };
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(mockPassengerRole);
      const savedUser = { ...mockUser, email: 'test@ictu.edu.vn' };
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);
      jwtService.signAsync.mockResolvedValue('token');

      await service.register(dtoUpperEmail);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@ictu.edu.vn' },
      });
    });
  });

  // ========================================
  // LOGIN TESTS
  // ========================================
  describe('login()', () => {
    const loginDto = {
      email: 'test@ictu.edu.vn',
      password: 'Password@123',
    };

    it('should login successfully with correct credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException when email not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow(
        'Email hoặc mật khẩu không chính xác',
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      const lockedUser = { ...mockUser, status: UserStatus.LOCKED };
      userRepository.findOne.mockResolvedValue(lockedUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow(
        'Tài khoản đã bị tạm khóa hoặc chưa được kích hoạt',
      );
    });
  });

  // ========================================
  // LOGOUT TESTS
  // ========================================
  describe('logout()', () => {
    it('should logout successfully and clear refresh token', async () => {
      const result = await service.logout('user-uuid-1');

      expect(result).toEqual({ message: 'Đăng xuất thành công' });
      expect(userRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  // ========================================
  // GET ME TESTS
  // ========================================
  describe('getMe()', () => {
    it('should return user info without sensitive fields', async () => {
      const userWithSensitive = {
        ...mockUser,
        passwordHash: 'secret-hash',
        refreshTokenHash: 'secret-refresh',
      };
      userRepository.findOne.mockResolvedValue(userWithSensitive);

      const result = await service.getMe('user-uuid-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshTokenHash');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('fullName');
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe('nonexistent-uuid')).rejects.toThrow(
        'Không tìm thấy thông tin người dùng',
      );
    });
  });
});
