import { Controller, Post, Body } from '@nestjs/common';
import { IlumaService } from './iluma.service';
import { CheckAccountDto } from './dto/check-account.dto';

@Controller('/api/v2')
export class IlumaController {
  constructor(private readonly ilumaService: IlumaService) {}

  @Post('/checkAccount')
  async checkAccount(@Body() payload: CheckAccountDto) {
    return await this.ilumaService.checkAccount(payload);
  }

  @Post('/webhook/iluma/bank-validator')
  async ilumaBankValidator(@Body() payload: object) {
    return await this.ilumaService.ilumaBankValidator(payload);
  }
}
