import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { RegisterDto, LoginDto } from './dto/index.js';
import { Role } from '../../common/constants/roles.constant.js';
import { UserStatus } from '../../common/constants/status.constant.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống');
    }

    let passengerRole = await this.roleRepository.findOne({
      where: { name: Role.PASSENGER },
    });

    if (!passengerRole) {
      passengerRole = this.roleRepository.create({
        name: Role.PASSENGER,
        description: 'Hành khách',
      });
      await this.roleRepository.save(passengerRole);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phoneNumber: dto.phoneNumber,
      passwordHash,
      roleId: passengerRole.id,
      studentId: dto.studentId,
      faculty: dto.faculty,
      idCardNumber: dto.idCardNumber,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    const tokens = await this.generateTokens(savedUser.id, savedUser.email, passengerRole.name);
    await this.updateRefreshToken(savedUser.id, tokens.refreshToken);

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: passengerRole.name,
        studentId: savedUser.studentId,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
      relations: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa hoặc chưa được kích hoạt');
    }

    const roleName = user.role?.name || Role.PASSENGER;
    const tokens = await this.generateTokens(user.id, user.email, roleName);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: roleName,
        avatarUrl: user.avatarUrl,
        studentId: user.studentId,
        faculty: user.faculty,
      },
      ...tokens,
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    const { passwordHash, refreshTokenHash, ...result } = user;
    return result;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'smart-bus-jwt-refresh-secret-key-2026';
      const payload = this.jwtService.verify(refreshToken, { secret: refreshSecret });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: { role: true },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
      }

      const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isValid) {
        throw new UnauthorizedException('Phiên đăng nhập đã hết hạn hoặc bị từ chối');
      }

      const roleName = user.role?.name || Role.PASSENGER;
      const tokens = await this.generateTokens(user.id, user.email, roleName);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshTokenHash: null as any });
    return { message: 'Đăng xuất thành công' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessSecret = process.env.JWT_SECRET || 'smart-bus-jwt-access-secret-key-2026';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'smart-bus-jwt-refresh-secret-key-2026';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshTokenHash: hash });
  }
}
