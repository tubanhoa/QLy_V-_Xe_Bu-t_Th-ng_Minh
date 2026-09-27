import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { CreateVoucherDto, ValidateVoucherDto } from './dto/promotion.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@Injectable()
export class VoucherService {
  constructor(
    @InjectRepository(VoucherEntity)
    private readonly voucherRepository: Repository<VoucherEntity>,
  ) {}

  async create(dto: CreateVoucherDto) {
    const existing = await this.voucherRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(`Mã voucher ${dto.code} đã tồn tại`);
    }

    const voucher = this.voucherRepository.create({
      code: dto.code.toUpperCase(),
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minOrderValue: dto.minOrderValue || 0,
      maxDiscountAmount: dto.maxDiscountAmount,
      startDate: dto.startDate,
      endDate: dto.endDate,
      usageLimit: dto.usageLimit || 0,
      usedCount: 0,
      status: 'active',
    });

    return this.voucherRepository.save(voucher);
  }

  async findAll(pagination: PaginationDto) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.voucherRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

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

  async validate(dto: ValidateVoucherDto) {
    const voucher = await this.voucherRepository.findOne({
      where: { code: dto.code.toUpperCase() },
    });

    if (!voucher || voucher.status !== 'active') {
      return {
        valid: false,
        message: 'Mã khuyến mại không tồn tại hoặc đã bị vô hiệu hóa',
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (voucher.startDate > today) {
      return { valid: false, message: 'Chương trình khuyến mại chưa bắt đầu' };
    }

    if (voucher.endDate < today) {
      return { valid: false, message: 'Mã khuyến mại đã hết hạn sử dụng' };
    }

    if (voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return { valid: false, message: 'Mã khuyến mại đã hết lượt sử dụng' };
    }

    if (dto.orderAmount < Number(voucher.minOrderValue)) {
      return {
        valid: false,
        message: `Đơn hàng tối thiểu phải từ ${Number(voucher.minOrderValue).toLocaleString(
          'vi-VN',
        )} VND`,
      };
    }

    let discountAmount = 0;
    if (voucher.discountType === 'percentage') {
      discountAmount = Math.round((dto.orderAmount * Number(voucher.discountValue)) / 100);
      if (voucher.maxDiscountAmount && discountAmount > Number(voucher.maxDiscountAmount)) {
        discountAmount = Number(voucher.maxDiscountAmount);
      }
    } else {
      discountAmount = Number(voucher.discountValue);
    }

    const finalAmount = Math.max(0, dto.orderAmount - discountAmount);

    return {
      valid: true,
      message: 'Áp dụng mã khuyến mại thành công!',
      voucherCode: voucher.code,
      discountAmount,
      finalAmount,
    };
  }
}
