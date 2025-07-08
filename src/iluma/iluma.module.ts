import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { IlumaController } from './iluma.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entiy';
import { IlumaCallback } from './entities/iluma-callback.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IlumaCallLog, IlumaCallback])],
  providers: [IlumaService],
  controllers: [IlumaController],
  exports: [IlumaService]
})
export class IlumaModule {}
