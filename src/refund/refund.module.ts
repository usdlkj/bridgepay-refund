import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { RefundController } from './refund.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refund } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { RefundBank } from './entities/refund-bank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Refund, RefundDetail, RefundDetailTicket, RefundBank])],
  providers: [RefundService],
  controllers: [RefundController],
  exports: [RefundService]
})
export class RefundModule {}
