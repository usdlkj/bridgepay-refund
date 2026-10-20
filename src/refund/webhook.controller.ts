import { Controller, Post, Body, Headers } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { XenditWebhookDto } from './dto/xendit-webhook.dto';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { XenditWebhooRpcDto } from './dto/xendit-webhook-rpc.dto';
import { RefundDeliveryService } from '../broker/refund-delivery.service';

@Controller('/api/v2/webhook')
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly delivery: RefundDeliveryService,
  ) {}

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

  // Event, not RPC: Gateway acknowledges Xendit after broker confirmation only.
  @EventPattern({ cmd: 'refund.webhook.xendit.disbursement' })
  async webhookXenditRpc(
    @Payload() payload: XenditWebhooRpcDto,
    @Ctx() context: RmqContext,
  ) {
    return this.delivery.handle(context, () =>
      this.webhookService.xendit(payload.payload, undefined, payload.req, true),
      true,
    );
  }
}
