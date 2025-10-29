import { Injectable,Inject,HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank,SearchBankStatus } from 'src/refund/entities/refund-bank.entity';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository,IsNull, Not } from 'typeorm';
import { Refund } from './entities/refund.entity';
const listType =['string',"string","fixed"];
const field=["bank_name","xendit_code","bank_status"]

@Injectable()
export class BankService {
    private env: string;
        
        constructor(
        private helper:Helper,
        @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,
    
        @InjectRepository(RefundBank)
        private repositoryRefundBank: Repository<RefundBank>,
        private searchBankStatus : SearchBankStatus,

        @InjectRepository(IlumaCallLog)
        private repositoryCallLog: Repository<IlumaCallLog>,
    
        private readonly configService: ConfigService,

        private readonly yggdrasilService: YggdrasilService
    
        ) {
        this.env = getEnv(this.configService);
        }

    async list(columns){
        try{
            let qb = await this.repositoryRefundBank.createQueryBuilder('refundBank');
            if(columns){
                for(let row of columns){
                    let search = row.search.value;
                    let index = row.data;
                    if(search!=''){
                        if(listType[index]=="string"){
                            qb.andWhere(`"${field[index]}" iLike '%${search}%'`)
                        }else if(listType[index]=="fixed"){
                            qb.andWhere(`"${field[index]}" = '${search}'`)
                        }else if(listType[index]=='number'){
                            qb.andWhere(`"${field[index]}" = '${search}'`)
                        }else if(listType[index]=='enum'){
                            let statusSearch = await this.searchBankStatus.get(search.toLowerCase());
                            qb.andWhere(`"${field[index]}" = '${statusSearch}'`)
                        }else{
                            let date = moment.tz(search, 'DD-MM-YYYY', 'Asia/Jakarta');
                            let startDate = date.toISOString();
                            let endDate = date.add(1, 'day').toISOString();
                            qb.andWhere(`"${field[index]}" BETWEEN '${startDate}' AND '${endDate}'`)
                        }

                    }
                }
            } 
            let data = await qb.getMany();
            return data;
   
        }catch(e){
            throw new HttpException({status:500,message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
        
    }

    async view(id){
        return await this.repositoryRefundBank.findOne({
            where:{
                id:id
            }
        });
    }

    async update(id,payload){
        return this.repositoryRefundBank.update(id,payload);
    }




    async bankSync(){
        
        try{
           this.#bankProviderSync();
           let result={
            status:200,
            message:"Success"
            }
            return result 
        }catch(e){
            throw new HttpException({status:500,message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
        
    }


    async #bankProviderSync(){
        await this.#xenditSync()
        await this.#ilumaSync()
    }

    async #xenditSync(){
        try{
           
            let credential = await this.#getXenditToken();
            let payload = {
                provider:"xendit",
                func:"bank-list",
                token:credential.secretKey
            }
            let xendit = await this.yggdrasilService.refund(payload)
            if(xendit.status!=200){
                throw new Error(xendit.data)
            }else{
                let result =[];
                // xendit.data.map(async function(value,index){
                    
                // })
                for(let value of xendit.data){
                    let temp ={
                        bankName:value.name,
                        xenditCode:value.code.trim(),
                        xenditData:value
                    }
                    let _where={
                        where:{
                            xenditCode:value.code.trim()
                        }
                    }
                    let upsert = await this.#bankUpsert(_where,temp);
                    if(upsert.status==500){
                        result.push(`xenditCode ${value.code} : ${upsert.msg}`);
                    }
                }
                // if(result.length >0){
                //     log.cronlog(JSON.stringify(result))
                // }else{
                //     log.cronlog("Xendit bank data synced")
                // }
                return "OK"
            }
        }catch(e){
            throw new HttpException({status:500,message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }

    }
    async #ilumaSync(){
        try{
            let payload = {
                provider:"iluma",
                func:"bank-list",
                credential:this.configService.get('ilumaToken')
            }
            let iluma = await this.yggdrasilService.refund(payload)
            let payloadLog = {
                url:"https://api.iluma.ai/bank/available_bank_codes",
                payload:null,
                method:"get",
                response:iluma
            }
            let payloadLogSave = await this.repositoryCallLog.create(payloadLog);
            await this.repositoryCallLog.save(payloadLogSave);
            // console.log(iluma);
            if(iluma.status!=200){
                throw new Error(iluma.msg)
            }else{
                let result =[];
                for(let value of iluma.data){
                    let _where= {
                        where:{
                            xenditCode:value.code.trim()
                        }
                    }
                    let check = await this.repositoryRefundBank.findOne(_where);
                    if(check){
                        let data ={
                            ilumaCode:value.code.trim(),
                            ilumaData:value,
                        }
                        let update = await this.repositoryRefundBank.update(check.id,data);
                    }else{
                        result.push(`iluma ${value.code} : cant mapping to xendit bank data`);
                    }
                }
                // if(result.length >0){
                //     log.cronlog(JSON.stringify(result))
                // }else{
                //     log.cronlog("iluma bank data synced")
                // }
            }
        }catch(e){
            throw new HttpException({status:500,message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
    }

    async #bankUpsert(where: object,payload:object){
        try{
            let check = await this.repositoryRefundBank.findOne(where);
            // console.log(check);
            let result;
            if(check){
                payload["updatedAt"]=moment().toISOString()
                result = await this.repositoryRefundBank.update(check.id,payload);
            }else{

                payload["createdAt"]=moment().toISOString()
                payload["updatedAt"]=moment().toISOString()
                let payloadSave = await this.repositoryRefundBank.create(payload);
               result = await this.repositoryRefundBank.save(payloadSave);
            }
            return {
                status:200,
                msg:"Success"
            }
        }catch(e){
            return {
                status:500,
                msg:e.message
            }
        }
    }

    async #getXenditToken(){
        const pgData = await this.coreService.send({ cmd: 'get-payment-gateway-like-name' },{pgName:'xendit'}).toPromise();
        const credentialData = JSON.parse(pgData.credential);
        // console.log(credentialData);
        const credential = credentialData[await this.configService.get('nodeEnv')];
        return credential
    }
}
