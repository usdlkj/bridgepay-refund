import {
  Body,
  Controller,
  // Delete,
  Get,
  // Param,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';

@Controller('/api/v2/payment-gateways')
export class PaymentGatewayController {
  constructor(private readonly service: PaymentGatewayService) {}

  @Get()
  async getPaymentGatewayByName(@Query('pgName') pgName: string) {
    return this.service.findOneLikeName({ pgName });
  }

  @Post()
  async create(@Body() dto: CreatePaymentGatewayDto) {
    return this.service.createOrUpdate(dto);
  }

  /**
   * Commented out due to the inherent risk of accidental deletion.
   * @param id
   * @returns
   */
  // @Delete(':id')
  // async delete(@Param('id') id: string) {
  //   return this.service.delete(id);
  // }
}
