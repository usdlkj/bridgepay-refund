import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { XenditModule } from './xendit/xendit.module';
import { IlumaModule } from './iluma/iluma.module';

@Module({
  providers: [RefundService],
  imports: [XenditModule, IlumaModule],
  exports: [RefundService],
})
export class RefundModule {}
