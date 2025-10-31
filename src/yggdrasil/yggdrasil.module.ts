import { Module } from '@nestjs/common';
import { YggdrasilService } from './yggdrasil.service';
import { RefundModule } from './refund/refund.module';

@Module({
  providers: [YggdrasilService],
  exports: [YggdrasilService],
  imports: [RefundModule],
})
export class YggdrasilModule {}
