import { Controller,Get, Post, Body,Headers,Query, Param  } from '@nestjs/common';
import { BankService } from './bank.service';

@Controller('/api/v2/banks')
export class BankController {
    constructor(
        private readonly bankService: BankService,
    ) {}


    //backoffice banks
    @Post('/sync')
    async bankSync(){
        return this.bankService.bankSync();
    }

    @Get('/')
    async banksList(@Body('query') query){
        return this.bankService.list(query)
    }

    @Get('/:id')
    async banksView(@Param("id") id:string){
        return this.bankService.view(id)

    }

    @Post('/:id')
    async banksUpdate(@Param("id") id:string,@Body() payload:{bankStatus:'enable'|'disable'}){
        return this.bankService.update(id,payload)
    }

    



}
