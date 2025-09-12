import { Controller,Get, Post, Body } from '@nestjs/common';
import {RefundService } from './refund.service';
import { WebhookService } from './webhook.service';
import { BackofficeService } from './backoffice.service';

@Controller('/api/v2')
export class RefundController {
    constructor(
        private readonly refundService: RefundService,
        private readonly webhookService: WebhookService,
        private readonly backofficeService: BackofficeService,
    ) {}
    @Get('/bankCodes')
    async bankList(){
        return this.refundService.bankList();
    }

    @Post('/banks/sync')
    async bankSync(){
        return this.backofficeService.bankSync();
    }

    @Post('/transfer')
    async createRefund(@Body() payload:Object){
        return this.refundService.create(payload);
    }

    @Post('/transferQuery')
    async queryRefund(@Body() payload:Object){
        return this.refundService.status(payload);
    }

}
