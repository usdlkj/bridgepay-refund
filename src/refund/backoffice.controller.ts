import { Controller, Get, Body, Param, Post } from '@nestjs/common';
import { BackofficeService } from './backoffice.service';
import { BankService } from './bank.service';
import { BankStatus } from './entities/refund-bank.entity';

@Controller('/api/v2/refunds')
export class BackofficeController {
  constructor(
    private readonly backofficeService: BackofficeService,
    private readonly bankService: BankService,
  ) {}

  @Post('/banks/:id')
  async changeBankStatus(
    @Param('id') id: string,
    @Body('bankStatus') bankStatus: string,
  ) {
    const _status = bankStatus === 'enable' ? BankStatus.ENABLE : (bankStatus === 'disable' ? BankStatus.DISABLE : (() => { throw new Error('Invalid bank status') })());
    return this.bankService.update(id, { bankStatus: _status });
  }

  @Get('/')
  async refundList(@Body('query') query) {
    return this.backofficeService.list(query);
  }
  @Get('/log')
  async refundLog(@Body('query') query) {
    return this.backofficeService.refundLog(query);
  }
  @Get('/refundDetail/:id')
  async refundDetail(@Param('id') id: string) {
    return this.backofficeService.refundDetail(id);
  }

  @Get('/:id')
  async refundView(@Param('id') id: string) {
    return this.backofficeService.view(id);
  }

}
