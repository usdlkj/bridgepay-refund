import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { UtilsModule } from 'src/utils/util.module';
import { PaymentGatewayController } from './payment-gateway.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentGateway]), UtilsModule],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
  controllers: [PaymentGatewayController],
})
export class PaymentGatewayModule {}
