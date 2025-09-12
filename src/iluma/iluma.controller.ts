import { Controller,Get, Post, Body } from '@nestjs/common';
import { IlumaService } from './iluma.service';

@Controller('/api/v2')
export class IlumaController {
    constructor(
        private readonly ilumaService: IlumaService,
    ) {}   
    
    @Post('/checkAccount')
    async checkAccount(@Body() payload:Object){
        return await this.ilumaService.checkAccount(payload);
    }

}
