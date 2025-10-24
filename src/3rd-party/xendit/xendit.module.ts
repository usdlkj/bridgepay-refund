import { Module } from '@nestjs/common';
import { XenditController } from './xendit.controller';
import { XenditService } from './xendit.service';
import { Helper } from 'src/utils/helper';

@Module({
  controllers: [XenditController],
  providers: [XenditService, Helper],
  exports: [XenditService],
})
export class XenditModule {}
