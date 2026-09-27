import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller.js';

@Module({
  controllers: [UploadController],
  exports: [],
})
export class UploadModule {}
