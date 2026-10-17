import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyPassEntity } from '../../database/entities/monthly-pass.entity.js';
import { MonthlyPassTransactionEntity } from '../../database/entities/monthly-pass-transaction.entity.js';
import { RouteEntity } from '../../database/entities/route.entity.js';
import { VoucherEntity } from '../../database/entities/voucher.entity.js';
import { MonthlyPassService } from './monthly-pass.service.js';
import { MonthlyPassController } from './monthly-pass.controller.js';
import { VoucherService } from './voucher.service.js';
import { VoucherController } from './voucher.controller.js';

import { PriorityVerificationEntity } from '../../database/entities/priority-verification.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonthlyPassEntity,
      MonthlyPassTransactionEntity,
      RouteEntity,
      VoucherEntity,
      PriorityVerificationEntity,
    ]),
  ],
  controllers: [MonthlyPassController, VoucherController],
  providers: [MonthlyPassService, VoucherService],
  exports: [MonthlyPassService, VoucherService],
})
export class PromotionModule {}
