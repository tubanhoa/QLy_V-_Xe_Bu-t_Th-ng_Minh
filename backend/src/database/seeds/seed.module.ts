import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities/index.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
