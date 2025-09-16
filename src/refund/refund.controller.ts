import { Controller,Get, Post, Body,Headers,Query, Param  } from '@nestjs/common';
import {RefundService } from './refund.service';
import { WebhookService } from './webhook.service';
import { BackofficeService } from './backoffice.service';
import { BankService } from './bank.service';

@Controller('/api/v2')
export class RefundController {
    constructor(
        private readonly refundService: RefundService,
        private readonly webhookService: WebhookService,
        private readonly backofficeService: BackofficeService,
        private readonly bankService: BankService,
    ) {}
    @Get('/bankCodes')
    async bankList(){
        return this.refundService.bankList();
    }


    @Post('/transfer')
    async createRefund(@Body() payload:Object){
        return this.refundService.create(payload);
    }

    @Post('/transferQuery')
    async queryRefund(@Body() payload:Object){
        return this.refundService.status(payload);
    }

    @Post("/webhook/xendit/disbursement")
    async webhookXendit(@Body() payload:Object,@Headers() headers: Record<string, string>){
        return this.webhookService.xendit(payload,headers['x-callback-token']);
    }


    //backoffice banks
    @Post('/banks/sync')
    async bankSync(){
        return this.bankService.bankSync();
    }

    @Get('/banks')
    async banksList(@Body('query') query){
        return this.bankService.list(query)
    }

    @Get('/banks/:id')
    async banksView(@Param("id") id:string){
        return this.bankService.view(id)

    }

    @Post('/banks/:id')
    async banksUpdate(@Param("id") id:string,@Body() payload:{bankStatus:'enable'|'disable'}){
        return this.bankService.update(id,payload)
    }

    //backoffice refund

    @Get('/refunds')
    async refundList(@Body('query') query){
        return this.backofficeService.list(query)
    }
    @Get('/refunds/refundDetail/:id')
    async refundDetail(@Param("id") id:string){
        return this.backofficeService.refundDetail(id)

    }

    @Get('/refunds/:id')
    async refundView(@Param("id") id:string){
        return this.backofficeService.view(id)

    }

    @Get('/refunds/:id/pg-callbacks')
    async refundPgCallback(@Param("id") id:string){
        return this.backofficeService.pgCallback(id)

    }

    



}
