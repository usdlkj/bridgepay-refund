import { Module } from '@nestjs/common';
import { BrokerModule } from 'src/broker/broker.module';
import { ConfigurationService } from './configuration.service';

@Module({
  imports: [BrokerModule],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
