import { Controller, Get, Body, Param, Post, UseGuards } from '@nestjs/common';
import { BackofficeService } from './backoffice.service';
import { BankService } from './bank.service';
import { BankStatus } from './entities/refund-bank.entity';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { RefundListQueryDto } from './dto/refund-list-query.dto';
import { RefundLogQueryDto } from './dto/refund-log-query.dto';

@Controller('/api/v2/refunds')
@UseGuards(ServiceAuthGuard)
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

  @Post('/')
  async refundList(@Body() body: RefundListQueryDto) {
    return this.backofficeService.list(body.query);
  }
  @Post('/log')
  async refundLog(@Body() body: RefundLogQueryDto) {
    return this.backofficeService.refundLog(body.query);
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
