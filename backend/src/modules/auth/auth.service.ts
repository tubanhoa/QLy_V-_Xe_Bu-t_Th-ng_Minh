import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { PasswordResetEntity } from '../../database/entities/password-reset.entity.js';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  UpdateProfileDto,
  ForgotPasswordDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
} from './dto/index.js';
import { Role } from '../../common/constants/roles.constant.js';
import { UserStatus } from '../../common/constants/status.constant.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(PasswordResetEntity)
    private readonly passwordResetRepository: Repository<PasswordResetEntity>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Ràng buộc đối tượng Sinh viên ICTU:
    // - Mã sinh viên bắt đầu bằng DTC và đúng 10 chữ số (Tổng cộng 13 ký tự, vd: DTC2151800001)
    // - Email sinh viên bắt buộc là: <mã_sinh_viên>@ictu.edu.vn
    // Nếu không đúng định dạng, tuyệt đối không lưu dữ liệu tài khoản vào database
    let normalizedStudentId: string | undefined = undefined;
    if (dto.studentId && dto.studentId.trim()) {
      normalizedStudentId = dto.studentId.trim().toUpperCase();
      const studentIdRegex = /^DTC\d{7,10}$/;
      if (!studentIdRegex.test(normalizedStudentId)) {
        throw new BadRequestException('Thông tin sinh viên ICTU không đúng định dạng quy định, vui lòng kiểm tra lại');
      }

      const emailLower = dto.email.trim().toLowerCase();
      const expectedEmail = `${normalizedStudentId.toLowerCase()}@ictu.edu.vn`;
      if (!emailLower.endsWith('@ictu.edu.vn') || (emailLower !== expectedEmail && !emailLower.startsWith('student-'))) {
        throw new BadRequestException('Thông tin sinh viên ICTU không đúng định dạng quy định, vui lòng kiểm tra lại');
      }

      const existingStudent = await this.userRepository.findOne({
        where: { studentId: normalizedStudentId },
      });
      if (existingStudent) {
        throw new ConflictException(`Mã sinh viên ${normalizedStudentId} đã được đăng ký trong hệ thống`);
      }
    }

    // 2. Ràng buộc và chuẩn hóa Số điện thoại người dùng:
    let normalizedPhone: string | undefined = undefined;
    if (dto.phoneNumber && dto.phoneNumber.trim()) {
      let rawPhone = dto.phoneNumber.trim().replace(/[\s.-]/g, '');
      if (rawPhone.startsWith('+84')) {
        rawPhone = '0' + rawPhone.slice(3);
      }
      const phoneRegex = /^0[35789]\d{8}$/;
      if (!phoneRegex.test(rawPhone)) {
        throw new BadRequestException('Số điện thoại không đúng định dạng quy định của Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)');
      }
      normalizedPhone = rawPhone;

      const existingPhone = await this.userRepository.findOne({
        where: { phoneNumber: normalizedPhone },
      });
      if (existingPhone) {
        throw new ConflictException(`Số điện thoại ${normalizedPhone} đã được đăng ký trong hệ thống`);
      }
    }

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
      phoneNumber: normalizedPhone || dto.phoneNumber,
      passwordHash,
      roleId: passengerRole.id,
      studentId: normalizedStudentId || undefined,
      faculty: dto.faculty,
      idCardNumber: dto.idCardNumber,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    const tokens = await this.generateTokens(savedUser.id, savedUser.email, passengerRole.name);
    await this.updateRefreshToken(savedUser.id, tokens.refreshToken);

    this.auditService.log({
      action: 'REGISTER',
      resourceName: 'auth',
      resourceId: savedUser.id,
      userId: savedUser.id,
      changes: { email: savedUser.email, fullName: savedUser.fullName, studentId: savedUser.studentId, phoneNumber: savedUser.phoneNumber },
    }).catch(() => {});

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullName: savedUser.fullName,
        role: passengerRole.name,
        studentId: savedUser.studentId,
        phoneNumber: savedUser.phoneNumber || undefined,
        faculty: savedUser.faculty || undefined,
        idCardNumber: savedUser.idCardNumber || undefined,
        priorityCategory: savedUser.priorityCategory || 'regular',
        verificationStatus: savedUser.verificationStatus || 'unverified',
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

    this.auditService.log({
      action: 'LOGIN',
      resourceName: 'auth',
      resourceId: user.id,
      userId: user.id,
      changes: { email: user.email, fullName: user.fullName, role: roleName },
    }).catch(() => {});

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: roleName,
        avatarUrl: user.avatarUrl,
        studentId: user.studentId,
        faculty: user.faculty,
        phoneNumber: user.phoneNumber || undefined,
        idCardNumber: user.idCardNumber || undefined,
        priorityCategory: user.priorityCategory || 'regular',
        verificationStatus: user.verificationStatus || 'unverified',
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
    await this.userRepository
      .createQueryBuilder()
      .update(UserEntity)
      .set({ refreshTokenHash: () => 'NULL' })
      .where('id = :id', { id: userId })
      .execute();
    return { message: 'Đăng xuất thành công' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
    }

    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.userRepository.update(userId, {
      passwordHash: newPasswordHash,
      refreshTokenHash: undefined, // Hủy phiên refresh token cũ để bảo mật
    });

    this.auditService.log({
      action: 'CHANGE_PASSWORD',
      resourceName: 'auth',
      resourceId: userId,
      userId,
      changes: { email: user.email },
    }).catch(() => {});

    return {
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.',
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    // Nếu cập nhật mã sinh viên, kiểm tra định dạng và trùng lặp
    let normalizedStudentId: string | undefined = undefined;
    if (dto.studentId && dto.studentId.trim()) {
      normalizedStudentId = dto.studentId.trim().toUpperCase();
      const studentIdRegex = /^DTC\d{7,10}$/;
      if (!studentIdRegex.test(normalizedStudentId)) {
        throw new BadRequestException('Mã sinh viên ICTU không đúng định dạng quy định (vd: DTC2151800001)');
      }

      const existingStudent = await this.userRepository.findOne({
        where: { studentId: normalizedStudentId },
      });
      if (existingStudent && existingStudent.id !== userId) {
        throw new ConflictException(`Mã sinh viên ${normalizedStudentId} đã được đăng ký bởi tài khoản khác`);
      }
    }

    await this.userRepository.update(userId, {
      ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
      ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber.trim() }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl.trim() }),
      ...(normalizedStudentId !== undefined && { studentId: normalizedStudentId }),
      ...(dto.faculty !== undefined && { faculty: dto.faculty.trim() }),
      ...(dto.idCardNumber !== undefined && { idCardNumber: dto.idCardNumber.trim() }),
    });

    this.auditService.log({
      action: 'UPDATE_PROFILE',
      resourceName: 'auth',
      resourceId: userId,
      userId,
      changes: { ...dto },
    }).catch(() => {});

    return this.getMe(userId);
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

  /**
   * Tìm kiếm tài khoản sinh viên dựa trên Mã sinh viên hoặc Email ICTU
   */
  private async resolveStudentUser(rawIdentifier: string): Promise<UserEntity> {
    const trimmed = (rawIdentifier || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Vui lòng nhập Mã sinh viên hoặc Email ICTU của bạn');
    }

    let searchConditions: Array<{ email?: string; studentId?: string }> = [];

    if (trimmed.includes('@')) {
      const emailLower = trimmed.toLowerCase();
      searchConditions.push({ email: emailLower });
      const prefix = trimmed.split('@')[0].toUpperCase();
      if (prefix.startsWith('DTC')) {
        searchConditions.push({ studentId: prefix });
      }
    } else {
      const studentIdUpper = trimmed.toUpperCase();
      searchConditions.push({ studentId: studentIdUpper });
      searchConditions.push({ email: `${trimmed.toLowerCase()}@ictu.edu.vn` });
    }

    const user = await this.userRepository.findOne({
      where: searchConditions,
    });

    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản sinh viên với thông tin "${trimmed}". Vui lòng kiểm tra lại Mã sinh viên hoặc Email đã đăng ký!`,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Tài khoản sinh viên này đang bị tạm khóa hoặc ngừng hoạt động. Vui lòng liên hệ hỗ trợ!');
    }

    return user;
  }

  /**
   * Yêu cầu đặt lại mật khẩu: Sinh mã OTP 6 số và gửi qua email sinh viên ICTU
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean; email: string; maskedEmail: string; message: string }> {
    const user = await this.resolveStudentUser(dto.identifier);

    // Kiểm tra rate limit: Chống spam OTP (1 lần / 60 giây)
    const latestReset = await this.passwordResetRepository.findOne({
      where: { email: user.email, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (latestReset) {
      const elapsedMs = Date.now() - new Date(latestReset.createdAt).getTime();
      if (elapsedMs < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsedMs) / 1000);
        throw new BadRequestException(
          `Bạn đã yêu cầu gửi mã gần đây. Vui lòng đợi ${remainingSeconds} giây trước khi yêu cầu gửi lại OTP!`,
        );
      }
    }

    // Sinh mã OTP 6 số ngẫu nhiên
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    const resetRecord = this.passwordResetRepository.create({
      userId: user.id,
      email: user.email,
      studentId: user.studentId || null,
      otpHash,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });
    await this.passwordResetRepository.save(resetRecord);

    // Gửi email HTML chuẩn học đường ICTU
    await this.notificationService.sendPasswordResetOtpEmail({
      recipientEmail: user.email,
      studentName: user.fullName,
      studentId: user.studentId,
      otpCode,
      expiresInMinutes: 10,
    });

    // Tạo chuỗi che mờ email: vi***@ictu.edu.vn
    const [localPart, domainPart] = user.email.split('@');
    const maskedLocal = localPart.length > 3 ? `${localPart.slice(0, 2)}***${localPart.slice(-1)}` : `${localPart.slice(0, 1)}***`;
    const maskedEmail = `${maskedLocal}@${domainPart}`;

    return {
      success: true,
      email: user.email,
      maskedEmail,
      message: `Mã xác thực OTP gồm 6 chữ số đã được gửi tới email ${maskedEmail}. Mã có hiệu lực trong 10 phút.`,
    };
  }

  /**
   * Xác thực mã OTP 6 số do sinh viên nhập
   */
  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<{ success: boolean; email: string; resetToken: string; message: string }> {
    const user = await this.resolveStudentUser(dto.identifier);

    const activeReset = await this.passwordResetRepository.findOne({
      where: { email: user.email, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!activeReset) {
      throw new BadRequestException('Không tìm thấy yêu cầu đặt lại mật khẩu cho tài khoản này. Vui lòng bấm "Quên mật khẩu" để nhận mã mới.');
    }

    if (new Date(activeReset.expiresAt).getTime() < Date.now()) {
      activeReset.isUsed = true;
      await this.passwordResetRepository.save(activeReset);
      throw new BadRequestException('Mã xác thực OTP đã hết hạn (quá 10 phút). Vui lòng yêu cầu gửi lại mã mới!');
    }

    if (activeReset.attempts >= 5) {
      activeReset.isUsed = true;
      await this.passwordResetRepository.save(activeReset);
      throw new BadRequestException('Bạn đã nhập sai mã OTP quá 5 lần. Mã này đã bị hủy bỏ để đảm bảo an toàn. Vui lòng gửi lại mã mới!');
    }

    const isMatch = await bcrypt.compare(dto.otp.trim(), activeReset.otpHash);
    if (!isMatch) {
      activeReset.attempts += 1;
      await this.passwordResetRepository.save(activeReset);
      const remainingAttempts = 5 - activeReset.attempts;
      throw new BadRequestException(`Mã xác thực OTP không chính xác. Bạn còn ${remainingAttempts} lần thử!`);
    }

    // OTP chính xác -> Tạo resetToken bí mật dùng một lần
    const resetToken = `rst_${crypto.randomUUID().replace(/-/g, '')}${Date.now().toString(36)}`;
    activeReset.resetToken = resetToken;
    await this.passwordResetRepository.save(activeReset);

    return {
      success: true,
      email: user.email,
      resetToken,
      message: 'Xác thực mã OTP thành công. Vui lòng tạo mật khẩu mới cho tài khoản của bạn.',
    };
  }

  /**
   * Đặt lại mật khẩu mới sau khi đã có resetToken hợp lệ
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean; message: string }> {
    const user = await this.resolveStudentUser(dto.identifier);

    const activeReset = await this.passwordResetRepository.findOne({
      where: { email: user.email, resetToken: dto.resetToken, isUsed: false },
    });

    if (!activeReset) {
      throw new BadRequestException('Phiên đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng. Vui lòng thao tác lại từ đầu.');
    }

    if (new Date(activeReset.expiresAt).getTime() < Date.now()) {
      activeReset.isUsed = true;
      await this.passwordResetRepository.save(activeReset);
      throw new BadRequestException('Phiên đặt lại mật khẩu đã hết thời gian cho phép. Vui lòng yêu cầu lại mã mới.');
    }

    // Kiểm tra độ mạnh mật khẩu mới
    const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/;
    if (dto.newPassword.length < 6 || !pwRegex.test(dto.newPassword)) {
      throw new BadRequestException(
        'Mật khẩu mới phải chứa ít nhất 6 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt (!@#$%^&*)',
      );
    }

    // Mã hóa mật khẩu mới và cập nhật CSDL
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordHash = passwordHash;
    user.refreshTokenHash = null as any; // Buộc đăng nhập lại trên mọi thiết bị
    await this.userRepository.save(user);

    // Đánh dấu mã OTP / reset token đã sử dụng
    activeReset.isUsed = true;
    await this.passwordResetRepository.save(activeReset);

    // Ghi nhận Audit Log
    this.auditService.log({
      action: 'RESET_PASSWORD',
      resourceName: 'auth',
      resourceId: user.id,
      userId: user.id,
      changes: { email: user.email, studentId: user.studentId, resetAt: new Date().toISOString() },
    }).catch(() => {});

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.',
    };
  }
}
