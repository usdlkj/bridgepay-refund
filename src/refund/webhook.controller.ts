import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { XenditWebhookDto } from './dto/xendit-webhook.dto';
import { MessagePattern } from '@nestjs/microservices';
import { XenditWebhooRpcDto } from './dto/xendit-webhook-rpc.dto';

@Controller('/api/v2/webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  // Respond immediately — Xendit retries if no OK within 30s, regardless of our processing result
  @Post('/xendit/disbursement')
  async webhookXendit(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    this.webhookService
      .xendit(
        payload as unknown as XenditWebhookDto,
        headers['x-callback-token'],
        payload,
      )
      .catch((err) => {
        console.error('xendit disbursement webhook error:', err);
      });
    return { message: 'OK' };
  }

  @MessagePattern({ cmd: 'refund.webhook.xendit.disbursement' })
  async webhookXenditRpc(@Body() payload: XenditWebhooRpcDto) {
    return this.webhookService.xendit(
      payload.payload,
      payload.headers,
      payload.req,
    );
  }
}
