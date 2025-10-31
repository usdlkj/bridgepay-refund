import { Module } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { IlumaModule as IlumaGatewayModule } from 'src/3rd-party/iluma/iluma.module';

@Module({
  providers: [IlumaService],
  exports: [IlumaService],
  imports: [IlumaGatewayModule],
})
export class IlumaModule {}
