import { Controller, Get, Post, Body } from '@nestjs/common';
import { RefundService } from './refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { StatusRefundDto } from './dto/status-refund.dto';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { RefundDeliveryService } from '../broker/refund-delivery.service';

@Controller('/api/v2')
export class RefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly delivery: RefundDeliveryService,
  ) {}
  @Get('/bankCodes')
  async bankList() {
    return this.refundService.bankList();
  }

  @MessagePattern({ cmd: 'refund.bankList' })
  async bankListRpc(@Ctx() context: RmqContext) {
    return this.delivery.handle(context, () => this.refundService.bankList());
  }

  @Post('/transfer')
  async createRefund(@Body() payload: CreateRefundDto) {
    return this.refundService.create(payload);
  }

  @MessagePattern({ cmd: 'refund.create' })
  async createRefundRpc(
    @Payload() payload: CreateRefundDto,
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () => this.refundService.create(payload));
  }

  @Post('/transferQuery')
  async queryRefund(@Body() payload: StatusRefundDto) {
    return this.refundService.status(payload);
  }

  @MessagePattern({ cmd: 'refund.status' })
  async queryRefundRpc(
    @Payload() payload: StatusRefundDto,
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () => this.refundService.status(payload));
  }
}
