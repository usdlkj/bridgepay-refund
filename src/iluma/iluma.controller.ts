import { Controller, Post, Body } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { IlumaService } from './iluma.service';
import { CheckAccountDto } from './dto/check-account.dto';
import { RefundDeliveryService } from '../broker/refund-delivery.service';

@Controller('/api/v2')
export class IlumaController {
  constructor(
    private readonly ilumaService: IlumaService,
    private readonly delivery: RefundDeliveryService,
  ) {}

  @Post('/checkAccount')
  async checkAccount(@Body() payload: CheckAccountDto) {
    return await this.ilumaService.checkAccount(payload);
  }

  @MessagePattern({ cmd: 'iluma.checkAccount' })
  async checkAccountRpc(
    @Payload() payload: CheckAccountDto,
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () => this.ilumaService.checkAccount(payload));
  }

  @Post('/webhook/iluma/bank-validator')
  async ilumaBankValidator(@Body() payload: object) {
    return await this.ilumaService.ilumaBankValidator(payload);
  }

  @MessagePattern({ cmd: 'iluma.bankValidator' })
  async ilumaBankValidatorRpc(
    @Payload() payload: object,
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () => this.ilumaService.ilumaBankValidator(payload));
  }
}
