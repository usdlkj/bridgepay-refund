import { Controller, Get, Post, Body } from '@nestjs/common';
import { RefundService } from './refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { StatusRefundDto } from './dto/status-refund.dto';

@Controller('/api/v2')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}
  @Get('/bankCodes')
  async bankList() {
    return this.refundService.bankList();
  }

  @Post('/transfer')
  async createRefund(@Body() payload: CreateRefundDto) {
    return this.refundService.create(payload);
  }

  @Post('/transferQuery')
  async queryRefund(@Body() payload: StatusRefundDto) {
    return this.refundService.status(payload);
  }
}
