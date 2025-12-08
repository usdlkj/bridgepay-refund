import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { IlumaController } from './iluma.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entity';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { BrokerModule } from 'src/broker/broker.module';
import { Helper } from 'src/utils/helper';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { ConfigurationModule } from 'src/configuration/configuration.module';
import { BankData } from './entities/bank-data.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      IlumaCallLog,
      IlumaCallback,
      RefundBank,
      BankData,
    ]),
    BrokerModule,
    ConfigurationModule,
  ],
  providers: [IlumaService, Helper],
  controllers: [IlumaController],
  exports: [IlumaService, Helper],
})
export class IlumaModule {}
