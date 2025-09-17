import { Controller,Get, Post, Body,Headers,Query, Param  } from '@nestjs/common';
import {RefundService } from './refund.service';


@Controller('/api/v2')
export class RefundController {
    constructor(
        private readonly refundService: RefundService,
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



}
