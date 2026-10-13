import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfileEntity } from '../../database/entities/driver-profile.entity.js';
import { UserEntity } from '../../database/entities/user.entity.js';
import { RoleEntity } from '../../database/entities/role.entity.js';
import { NotificationEntity } from '../../database/entities/notification.entity.js';
import { DriverProfileService } from './driver-profile.service.js';
import { DriverProfileController } from './driver-profile.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverProfileEntity,
      UserEntity,
      RoleEntity,
      NotificationEntity,
    ]),
  ],
  controllers: [DriverProfileController],
  providers: [DriverProfileService],
  exports: [DriverProfileService],
})
export class DriverProfileModule {}
