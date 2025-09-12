import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { IlumaController } from './iluma.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entiy';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { BrokerModule } from 'src/broker/broker.module';
import { Helper } from 'src/utils/helper';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IlumaCallLog, IlumaCallback, RefundBank]),BrokerModule],
  providers: [IlumaService,Helper],
  controllers: [IlumaController],
  exports: [IlumaService]
})
export class IlumaModule {}
