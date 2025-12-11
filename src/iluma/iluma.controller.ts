import { Controller, Post, Body } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { IlumaService } from './iluma.service';
import { CheckAccountDto } from './dto/check-account.dto';

@Controller('/api/v2')
export class IlumaController {
  constructor(private readonly ilumaService: IlumaService) {}

  @Post('/checkAccount')
  async checkAccount(@Body() payload: CheckAccountDto) {
    return await this.ilumaService.checkAccount(payload);
  }

  @MessagePattern({ cmd: 'iluma.checkAccount' })
  async checkAccountRpc(@Payload() payload: CheckAccountDto) {
    return await this.ilumaService.checkAccount(payload);
  }

  @Post('/webhook/iluma/bank-validator')
  async ilumaBankValidator(@Body() payload: object) {
    return await this.ilumaService.ilumaBankValidator(payload);
  }

  @MessagePattern({ cmd: 'iluma.bankValidator' })
  async ilumaBankValidatorRpc(@Payload() payload: object) {
    return await this.ilumaService.ilumaBankValidator(payload);
  }
}
