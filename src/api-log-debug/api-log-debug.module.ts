import { Module } from '@nestjs/common';
import { ApiLogDebugService } from './api-log-debug.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiLogDebug } from './entities/api-log-debug.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiLogDebug])],
  providers: [ApiLogDebugService],
  exports: [ApiLogDebugService],
})
export class ApiLogDebugModule {}
