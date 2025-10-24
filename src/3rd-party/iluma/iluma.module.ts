import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { Helper } from 'src/utils/helper';

@Module({
  providers: [IlumaService, Helper],
  exports: [IlumaService],
})
export class IlumaModule {}
