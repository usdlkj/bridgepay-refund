import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { IlumaController } from './iluma.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entity';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { BrokerModule } from 'src/broker/broker.module';
import { Helper } from 'src/utils/helper';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { YggdrasilModule } from 'src/yggdrasil/yggdrasil.module';
import { ConfigurationModule } from 'src/configuration/configuration.module';
import { BankData } from './entities/bank-data.entity';
import { UtilsModule } from 'src/utils/util.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IlumaCallLog,
      IlumaCallback,
      RefundBank,
      BankData,
    ]),
    BrokerModule,
    YggdrasilModule,
    ConfigurationModule,
    UtilsModule
  ],
  providers: [IlumaService, Helper],
  controllers: [IlumaController],
  exports: [IlumaService],
})
export class IlumaModule {}
