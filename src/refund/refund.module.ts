import { Module  } from '@nestjs/common';
import { RefundService } from './refund.service';
import { RefundController } from './refund.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund,SearchRefundStatus } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { RefundBank,SearchBankStatus } from './entities/refund-bank.entity';
import { BrokerModule } from 'src/broker/broker.module';
import { Helper } from 'src/utils/helper';
import { BackofficeService } from './backoffice.service';
import { WebhookService } from './webhook.service';
import { CronService } from './cron.service';
import { BankService } from './bank.service';
import { BankController } from './bank.controller';
import { BackofficeController } from './backoffice.controller';
import { WebhookController } from './webhook.controller';
import { RefundMiddleware } from './refund.middleware';


@Module({
  imports: [TypeOrmModule.forFeature([Refund, RefundDetail, RefundDetailTicket, RefundBank]),BrokerModule],
  providers: [RefundService,Helper, BackofficeService, WebhookService, CronService, BankService,SearchBankStatus,SearchRefundStatus],
  controllers: [RefundController,BankController,BackofficeController,WebhookController],
  exports: [RefundService]
})
export class RefundModule {}
