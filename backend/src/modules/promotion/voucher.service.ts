import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Like, ILike } from 'typeorm';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import {
  CreateVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
  QueryVoucherDto,
} from './dto/promotion.dto.js';

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(VoucherEntity)
    private readonly voucherRepository: Repository<VoucherEntity>,
  ) {}

  /**
   * Tạo mã voucher khuyến mại mới (Dành cho Marketing / Quản trị viên)
   */
  async create(dto: CreateVoucherDto) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // 1. Kiểm tra mã hợp lệ
    const codeRegex = /^[A-Z0-9_-]{3,30}$/;
    if (!codeRegex.test(normalizedCode)) {
      throw new BadRequestException(
        'Mã voucher không hợp lệ. Chỉ chấp nhận chữ cái, số, gạch nối từ 3 đến 30 ký tự!',
      );
    }

    // 2. Kiểm tra trùng lặp
    const existing = await this.voucherRepository.findOne({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new ConflictException(`Mã voucher "${normalizedCode}" đã tồn tại trong hệ thống!`);
    }

    // 3. Kiểm tra logic giảm giá
    if (dto.discountType === 'percentage') {
      if (dto.discountValue <= 0 || dto.discountValue > 100) {
        throw new BadRequestException('Mức giảm giá theo tỷ lệ phần trăm phải từ 1% đến 100%!');
      }
    } else if (dto.discountType === 'fixed_amount') {
      if (dto.discountValue < 1000) {
        throw new BadRequestException('Mức giảm giá cố định phải tối thiểu từ 1.000 VNĐ!');
      }
    }

    // 4. Kiểm tra thời hạn
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!');
    }

    const voucher = this.voucherRepository.create({
      code: normalizedCode,
      description: dto.description?.trim() || null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderValue: dto.minOrderValue || 0,
      maxDiscountAmount: dto.maxDiscountAmount || null,
      startDate: dto.startDate,
      endDate: dto.endDate,
      usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : 0,
      usedCount: 0,
      applicableType: dto.applicableType || 'all',
      applicableRouteIds: Array.isArray(dto.applicableRouteIds) && dto.applicableRouteIds.length > 0
        ? dto.applicableRouteIds
        : null,
      status: dto.status || 'active',
    });

    return this.voucherRepository.save(voucher);
  }

  /**
   * Danh sách các voucher khuyến mại (Hỗ trợ tìm kiếm, lọc theo trạng thái, phân loại)
   */
  async findAll(query: QueryVoucherDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const queryBuilder = this.voucherRepository.createQueryBuilder('v');

    // Lọc theo từ khóa tìm kiếm (Mã hoặc mô tả)
    if (query.search && query.search.trim()) {
      const keyword = `%${query.search.trim()}%`;
      queryBuilder.andWhere('(v.code ILIKE :kw OR v.description ILIKE :kw)', { kw: keyword });
    }

    // Lọc theo loại giảm giá
    if (query.applicableType && query.applicableType !== 'all') {
      queryBuilder.andWhere('(v.applicable_type = :appType OR v.applicable_type = :allType)', {
        appType: query.applicableType,
        allType: 'all',
      });
    }

    // Lọc theo trạng thái
    const today = new Date().toISOString().slice(0, 10);
    if (query.status && query.status !== 'all') {
      if (query.status === 'active') {
        queryBuilder.andWhere('v.status = :st AND v.end_date >= :today', { st: 'active', today });
      } else if (query.status === 'inactive') {
        queryBuilder.andWhere('v.status = :st', { st: 'inactive' });
      } else if (query.status === 'expired') {
        queryBuilder.andWhere('v.end_date < :today', { today });
      }
    }

    queryBuilder.orderBy('v.created_at', 'DESC').skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // Thêm dynamic status để hiển thị cho UI Admin
    const enriched = items.map((item) => {
      let dynamicStatus = item.status;
      if (item.status === 'active') {
        if (item.endDate < today) {
          dynamicStatus = 'expired';
        } else if (item.usageLimit > 0 && item.usedCount >= item.usageLimit) {
          dynamicStatus = 'depleted';
        }
      }
      return {
        ...item,
        dynamicStatus,
        remainingUses: item.usageLimit > 0 ? Math.max(0, item.usageLimit - item.usedCount) : 'unlimited',
      };
    });

    return {
      items: enriched,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Xem chi tiết một mã voucher theo ID hoặc Code
   */
  async findOne(id: string) {
    const voucher = await this.voucherRepository.findOne({
      where: [{ id }, { code: id.toUpperCase() }],
    });

    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy mã voucher "${id}"!`);
    }

    const today = new Date().toISOString().slice(0, 10);
    let dynamicStatus = voucher.status;
    if (voucher.status === 'active') {
      if (voucher.endDate < today) {
        dynamicStatus = 'expired';
      } else if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
        dynamicStatus = 'depleted';
      }
    }

    return {
      ...voucher,
      dynamicStatus,
      remainingUses: voucher.usageLimit > 0 ? Math.max(0, voucher.usageLimit - voucher.usedCount) : 'unlimited',
    };
  }

  /**
   * Chỉnh sửa thông tin voucher
   */
  async update(id: string, dto: UpdateVoucherDto) {
    const voucher = await this.voucherRepository.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy mã voucher với ID "${id}" để cập nhật!`);
    }

    // 1. Kiểm tra logic giảm giá nếu có cập nhật
    const discountType = dto.discountType || voucher.discountType;
    const discountValue = dto.discountValue !== undefined ? dto.discountValue : voucher.discountValue;

    if (discountType === 'percentage') {
      if (discountValue <= 0 || discountValue > 100) {
        throw new BadRequestException('Mức giảm giá theo tỷ lệ phần trăm phải từ 1% đến 100%!');
      }
    } else if (discountType === 'fixed_amount') {
      if (discountValue < 1000) {
        throw new BadRequestException('Mức giảm giá cố định phải tối thiểu từ 1.000 VNĐ!');
      }
    }

    // 2. Kiểm tra thời hạn
    const startDate = dto.startDate || voucher.startDate;
    const endDate = dto.endDate || voucher.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!');
    }

    // 3. Kiểm tra số lượng tối đa
    if (dto.usageLimit !== undefined && dto.usageLimit > 0 && dto.usageLimit < voucher.usedCount) {
      throw new BadRequestException(
        `Số lượng giới hạn (${dto.usageLimit}) không được nhỏ hơn số lượt đã sử dụng (${voucher.usedCount})!`,
      );
    }

    // Cập nhật các trường
    if (dto.description !== undefined) voucher.description = dto.description?.trim() || null;
    if (dto.discountType !== undefined) voucher.discountType = dto.discountType;
    if (dto.discountValue !== undefined) voucher.discountValue = dto.discountValue;
    if (dto.minOrderValue !== undefined) voucher.minOrderValue = dto.minOrderValue;
    if (dto.maxDiscountAmount !== undefined) voucher.maxDiscountAmount = dto.maxDiscountAmount;
    if (dto.startDate !== undefined) voucher.startDate = dto.startDate;
    if (dto.endDate !== undefined) voucher.endDate = dto.endDate;
    if (dto.usageLimit !== undefined) voucher.usageLimit = dto.usageLimit;
    if (dto.applicableType !== undefined) voucher.applicableType = dto.applicableType;
    if (dto.applicableRouteIds !== undefined) {
      voucher.applicableRouteIds = Array.isArray(dto.applicableRouteIds) && dto.applicableRouteIds.length > 0
        ? dto.applicableRouteIds
        : null;
    }
    if (dto.status !== undefined) voucher.status = dto.status;

    return this.voucherRepository.save(voucher);
  }

  /**
   * Kích hoạt / Hủy kích hoạt nhanh voucher (Toggle status)
   */
  async toggleStatus(id: string) {
    const voucher = await this.voucherRepository.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy mã voucher với ID "${id}"!`);
    }

    voucher.status = voucher.status === 'active' ? 'inactive' : 'active';
    await this.voucherRepository.save(voucher);

    return {
      id: voucher.id,
      code: voucher.code,
      status: voucher.status,
      message: `Đã ${voucher.status === 'active' ? 'kích hoạt' : 'hủy kích hoạt'} mã voucher "${voucher.code}" thành công!`,
    };
  }

  /**
   * Xóa mã voucher an toàn
   */
  async delete(id: string) {
    const voucher = await this.voucherRepository.findOne({ where: { id } });
    if (!voucher) {
      throw new NotFoundException(`Không tìm thấy mã voucher với ID "${id}" để xóa!`);
    }

    // Ràng buộc bảo toàn dữ liệu: Nếu voucher đã được dùng trong các đơn trước đó thì không được xóa cứng
    if (voucher.usedCount > 0) {
      throw new BadRequestException(
        `Mã voucher "${voucher.code}" đã được sử dụng ${voucher.usedCount} lần trong các giao dịch vé trước đây. Không thể xóa vĩnh viễn để bảo toàn lịch sử hóa đơn. Vui lòng chuyển sang trạng thái "Hủy kích hoạt" (Inactive)!`,
      );
    }

    await this.voucherRepository.remove(voucher);
    return {
      success: true,
      message: `Đã xóa vĩnh viễn mã voucher "${voucher.code}" thành công!`,
    };
  }

  /**
   * Kiểm tra điều kiện áp dụng và tính toán tiền giảm giá (Áp dụng tại luồng thanh toán)
   */
  async validate(dto: ValidateVoucherDto) {
    const normalizedCode = dto.code ? dto.code.trim().toUpperCase() : '';
    if (!normalizedCode) {
      return { valid: false, message: 'Vui lòng nhập mã voucher khuyến mại!' };
    }

    const voucher = await this.voucherRepository.findOne({
      where: { code: normalizedCode },
    });

    if (!voucher) {
      return {
        valid: false,
        message: `Mã voucher "${normalizedCode}" không tồn tại trên hệ thống!`,
      };
    }

    if (voucher.status !== 'active') {
      return {
        valid: false,
        message: `Mã voucher "${voucher.code}" đang bị tạm khóa hoặc đã ngừng áp dụng!`,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (voucher.startDate > today) {
      return {
        valid: false,
        message: `Chương trình khuyến mại "${voucher.code}" chưa bắt đầu (Áp dụng từ ngày ${voucher.startDate})!`,
      };
    }

    if (voucher.endDate < today) {
      return {
        valid: false,
        message: `Mã voucher "${voucher.code}" đã hết hạn sử dụng vào ngày ${voucher.endDate}!`,
      };
    }

    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return {
        valid: false,
        message: `Mã voucher "${voucher.code}" đã đạt giới hạn tối đa số lượt sử dụng!`,
      };
    }

    // Kiểm tra loại dịch vụ (Vé lượt / Vé tháng)
    if (voucher.applicableType && voucher.applicableType !== 'all' && dto.serviceType) {
      if (voucher.applicableType === 'single_ticket' && dto.serviceType === 'monthly_pass') {
        return {
          valid: false,
          message: `Mã voucher "${voucher.code}" chỉ áp dụng cho Vé Lượt xe buýt, không áp dụng cho Vé Tháng!`,
        };
      }
      if (voucher.applicableType === 'monthly_pass' && dto.serviceType === 'single_ticket') {
        return {
          valid: false,
          message: `Mã voucher "${voucher.code}" chỉ áp dụng cho Vé Tháng, không áp dụng cho Vé Lượt!`,
        };
      }
    }

    // Kiểm tra áp dụng theo tuyến xe buýt
    if (
      voucher.applicableRouteIds &&
      Array.isArray(voucher.applicableRouteIds) &&
      voucher.applicableRouteIds.length > 0 &&
      dto.routeId
    ) {
      if (!voucher.applicableRouteIds.includes(dto.routeId)) {
        return {
          valid: false,
          message: `Mã voucher "${voucher.code}" không áp dụng cho tuyến đường bạn đã chọn!`,
        };
      }
    }

    // Kiểm tra đơn hàng tối thiểu
    const orderAmount = Number(dto.orderAmount) || 0;
    if (orderAmount < Number(voucher.minOrderValue)) {
      return {
        valid: false,
        message: `Đơn hàng tối thiểu phải từ ${Number(voucher.minOrderValue).toLocaleString(
          'vi-VN',
        )} đ để áp dụng mã "${voucher.code}"!`,
      };
    }

    // Tính toán số tiền giảm giá
    let discountAmount = 0;
    if (voucher.discountType === 'percentage') {
      discountAmount = Math.round((orderAmount * Number(voucher.discountValue)) / 100);
      if (voucher.maxDiscountAmount && discountAmount > Number(voucher.maxDiscountAmount)) {
        discountAmount = Number(voucher.maxDiscountAmount);
      }
    } else {
      discountAmount = Number(voucher.discountValue);
    }

    // Khống chế số tiền giảm không vượt quá giá trị đơn hàng
    discountAmount = Math.min(orderAmount, discountAmount);

    // Tính số tiền thanh toán cuối cùng
    const finalAmount = Math.max(0, orderAmount - discountAmount);

    return {
      valid: true,
      message: `Áp dụng mã giảm giá "${voucher.code}" thành công!`,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      discountAmount,
      finalAmount,
      description: voucher.description,
    };
  }

  /**
   * Tiêu hao (consume) lượt dùng của voucher một cách nguyên tử trong giao dịch đặt vé
   */
  async consumeVoucher(code: string, manager?: EntityManager) {
    const normalizedCode = code.trim().toUpperCase();
    const repo = manager ? manager.getRepository(VoucherEntity) : this.voucherRepository;

    const voucher = await repo.findOne({
      where: { code: normalizedCode },
    });

    if (!voucher) return null;

    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      throw new BadRequestException(`Mã voucher "${code}" đã hết lượt sử dụng!`);
    }

    voucher.usedCount += 1;
    return repo.save(voucher);
  }
}
