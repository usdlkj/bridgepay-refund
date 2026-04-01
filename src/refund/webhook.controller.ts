import { Controller, Post, Body, Headers, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { XenditWebhookDto } from './dto/xendit-webhook.dto';
import { Request } from 'express';
import { MessagePattern } from '@nestjs/microservices';
import { XenditWebhooRpcDto } from './dto/xendit-webhook-rpc.dto';

@Controller('/api/v2/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('/xendit/disbursement')
  async webhookXendit(
    @Body() payload: XenditWebhookDto,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    return this.webhookService.xendit(
      payload,
      headers['x-callback-token'],
      req.body,
    );
  }

  @MessagePattern({ cmd: 'refund.webhook.xendit.disbursement' })
  async webhookXenditRpc(@Body() payload: XenditWebhooRpcDto){
    return this.webhookService.xendit(payload.payload,payload.headers,payload.req);
  }
}
