import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { BankService } from './bank.service';
import { UpdateRefundBankDto } from './dto/update-refund-bank.dto';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { BankListQueryDto } from './dto/bank-list-query.dto';

@Controller('/api/v2/banks')
@UseGuards(ServiceAuthGuard)
export class BankController {
  constructor(private readonly bankService: BankService) {}

  //backoffice banks
  @Post('/sync')
  async bankSync() {
    return this.bankService.bankSync();
  }

  @Post('/')
  async banksList(@Body() body: BankListQueryDto) {
    // Transform DTO to service-compatible format
    const columns = body.query?.map(col => ({
      data: col.data,
      search: {
        value: col.search?.value || '',
      },
    }));
    return this.bankService.list(columns);
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
