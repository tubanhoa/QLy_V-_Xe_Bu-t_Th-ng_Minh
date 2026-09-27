import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../database/entities/user.entity.js';
import { UserStatus } from '../../../common/constants/status.constant.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (!req) return null;
          if (req.cookies && (req.cookies['access_token'] || req.cookies['token'])) {
            return req.cookies['access_token'] || req.cookies['token'];
          }
          if (req.headers && req.headers.cookie) {
            const raw = req.headers.cookie;
            const cookies = raw.split(';').reduce((acc: any, c: string) => {
              const [k, v] = c.trim().split('=');
              if (k && v) acc[k] = decodeURIComponent(v);
              return acc;
            }, {});
            return cookies['access_token'] || cookies['token'] || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'smart-bus-jwt-access-secret-key-2026',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc chưa kích hoạt');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role?.name,
      roleId: user.roleId,
      studentId: user.studentId,
    };
  }
}
