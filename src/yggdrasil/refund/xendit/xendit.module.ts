import { Module } from '@nestjs/common';
import { XenditService } from './xendit.service';
import { XenditModule as XenditGatewayModule } from 'src/3rd-party/xendit/xendit.module';

@Module({
  providers: [XenditService],
  imports: [XenditGatewayModule],
  exports: [XenditService],
})
export class XenditModule {}
