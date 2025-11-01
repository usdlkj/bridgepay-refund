import { Controller, Post, Body } from '@nestjs/common';
import { IlumaService } from './iluma.service';

@Controller('/api/v2')
export class IlumaController {
  constructor(private readonly ilumaService: IlumaService) {}

  @Post('/checkAccount')
  async checkAccount(@Body() payload: object) {
    return await this.ilumaService.checkAccount(payload);
  }

  @Post('/webhook/iluma/bank-validator')
  async ilumaBankValidator(@Body() payload: object) {
    return await this.ilumaService.ilumaBankValidator(payload);
  }
}
