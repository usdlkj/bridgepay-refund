import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Param,
} from '@nestjs/common';
import { BackofficeService } from './backoffice.service';

@Controller('/api/v2/refunds')
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

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

  @Get('/:id/pg-callbacks')
  async refundPgCallback(@Param('id') id: string) {
    return this.backofficeService.pgCallback(id);
  }
}
