import { Injectable,Inject,HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository,IsNull, Not } from 'typeorm';
import { Refund,RefundStatus } from './entities/refund.entity';
import { RefundService } from './refund.service';

@Injectable()
export class BackofficeService {
    private env: string;
        
        constructor(
        private helper:Helper,
        @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,
    
        @InjectRepository(RefundBank)
        private repositoryRefundBank: Repository<RefundBank>,

        @InjectRepository(Refund)
        private repositoryRefund: Repository<Refund>,
    
        private readonly configService: ConfigService,
        private readonly refundService:RefundService
    
        ) {
        this.env = getEnv(this.configService);
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

    async retryDisbursement(refundId){
        try{
            let whereConfig = {
                where:{
                    configName: "REFUND_TRY_COUNT"
                }
            }
            let tryCount = await this.coreService.send({cmd:'get-config-data'},whereConfig).toPromise();
            let config = 1;
            if(tryCount){
                config=tryCount.configValue;
            }
            let failAttempt = config ||  1
            let _where = {
                where:{
                    refundId:refundId,
                    refundStatus:RefundStatus.FAIL
                }
            }
            let check = await this.repositoryRefund.findOne(_where)

            if(!check){
                throw new Error("Refund not found")
            }

            if(failAttempt==check.retryAttempt.length){
                throw new Error("Max Attempt to retry");
            }

            let pgCallback=check.pgCallback
            let requestData = check.requestData
            let lastIdxCallback = pgCallback?pgCallback.length-1:0;
            let lastIdxRequest = requestData?requestData.length-1:0;
            if(requestData && pgCallback && requestData[lastIdxRequest].external_id!=pgCallback[lastIdxCallback].pgCallback.external_id){
                throw new Error("This order has 1 request not have received from payment gateway. Please try again later");
            }

            let sequenceData=check.retryAttempt?check.retryAttempt:[];
            sequenceData.push(moment().format("YYYY-MM-DD HH:mm:ss"));
            let update = await this.repositoryRefund.update(check.id,{
                retryAttempt:sequenceData
            })
            let generatePayload= await this.refundService.generateXenditRefundPayload(check);
            await this.repositoryRefund.update(check.id,{
                requestData:generatePayload.requestData
            })
            let result;
            let credential = await this.#getXenditToken();
            let payloadDisbursement ={
                provider:"xendit",
                func:"disbursement",
                data:generatePayload.payloadRefund,
                token:credential.secretKey
            }

            let xendit = await this.coreService.send({cmd:"refund-core-service"},payloadDisbursement).toPromise();
            if(xendit.status==200){
                result ={
                    status:200,
                    message:"Success"
                }
                let update = await this.repositoryRefund.update(check.id,{refundStatus:RefundStatus.RETRY})
            }else{            
                throw new Error("Failed Xendit disbursement")
            }
            
            
        }catch(e){
            throw new Error(e.message)
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
            let xendit = await this.coreService.send({cmd:'refund-core-service'},payload).toPromise();
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
            let iluma = await this.coreService.send({cmd:'refund-core-service'},payload).toPromise();
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
                payload["updatedAt"]=moment().toISOString(),
               result = await this.repositoryRefundBank.save(payload);
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
