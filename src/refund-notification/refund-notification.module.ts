import { Module } from '@nestjs/common';
import { BrokerModule } from '../broker/broker.module';
import { RefundNotificationController } from './refund-notification.controller';
import { RefundNotificationService } from './refund-notification.service';

@Module({
  imports: [BrokerModule],
  controllers: [RefundNotificationController],
  providers: [RefundNotificationService],
  exports: [RefundNotificationService],
})
export class RefundNotificationModule {}
