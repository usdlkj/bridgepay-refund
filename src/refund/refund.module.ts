import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { RefundController } from './refund.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { RefundBank } from './entities/refund-bank.entity';
import { BrokerModule } from 'src/broker/broker.module';
import { Helper } from 'src/utils/helper';
import { BackofficeService } from './backoffice.service';
import { WebhookService } from './webhook.service';
import { CronService } from './cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Refund, RefundDetail, RefundDetailTicket, RefundBank]),BrokerModule],
  providers: [RefundService,Helper, BackofficeService, WebhookService, CronService],
  controllers: [RefundController],
  exports: [RefundService]
})
export class RefundModule {}
