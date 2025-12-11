import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BankService } from './bank.service';
import { UpdateRefundBankDto } from './dto/update-refund-bank.dto';

@Controller('/api/v2/banks')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  //backoffice banks
  @Post('/sync')
  async bankSync() {
    return this.bankService.bankSync();
  }

  @Get('/')
  async banksList(@Body('query') query) {
    return this.bankService.list(query);
  }

  @Get('/:id')
  async banksView(@Param('id') id: string) {
    return this.bankService.view(id);
  }

  @Post('/:id')
  async banksUpdate(
    @Param('id') id: string,
    @Body() payload: UpdateRefundBankDto,
  ) {
    return this.bankService.update(id, payload);
  }
}
