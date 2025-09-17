import { Controller,Get, Post, Body,Headers,Query, Param  } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('/api/v2/webhook')
export class WebhookController {
    constructor(
       private readonly webhookService: WebhookService,
    ) {}


    @Post("/xendit/disbursement")
    async webhookXendit(@Body() payload:Object,@Headers() headers: Record<string, string>){
        return this.webhookService.xendit(payload,headers['x-callback-token']);
    }   


}
