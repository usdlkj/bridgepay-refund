import { Injectable,Inject,HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config'
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository,IsNull, Not } from 'typeorm';
import { Refund,RefundStatus,SearchRefundStatus } from './entities/refund.entity';
import { ConfigurationService } from 'src/configuration/configuration.service';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import { RefundService } from './refund.service';
import { privateDecrypt } from 'crypto';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundLog } from './entities/refund-log.entity';
const listType =['string',"json","number","date","enum","date"];
const field=["refund_ga_number","refund_data->'reqData'->'account'->>'name'","refund_amount","created_at",'refund_status','refund_date']
const listTypeLog =['string',"string","string","string","date"];
const fieldLog=["type","location","msg","notes",'created_at']

@Injectable()
export class BackofficeService {
    private env: string;
        
        constructor(
        private helper:Helper,
        @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

        @InjectRepository(Refund)
        private repositoryRefund: Repository<Refund>,

        @InjectRepository(RefundLog)
        private repositoryRefundLog: Repository<RefundLog>,
    
        private readonly configService: ConfigService,
        private readonly refundService:RefundService,
        private readonly searchRefundStatus:SearchRefundStatus,
        private readonly configurationService:ConfigurationService,
        private readonly yggdrasilService : YggdrasilService
    
        ) {
        this.env = getEnv(this.configService);
        }
    
    async list(columns){
        try{
            let qb = await this.repositoryRefund.createQueryBuilder('refund');
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
                            let statusSearch = await this.searchRefundStatus.get(search.toLowerCase());
                            qb.andWhere(`"${field[index]}" = '${statusSearch}'`)
                        }else if(listType[index]=='json'){
                            qb.andWhere(`${field[index]} = '${search}'`)
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
        const refund = await this.repositoryRefund.createQueryBuilder('refund')
        .leftJoinAndMapOne(
            'refund.refundDetail', 
            RefundDetail, 
            'detail', 
            'detail.refund_mw_id = refund.id' // **NOTE:** Adjust this condition based on your actual FK structure
        )
        .leftJoinAndSelect('detail.ticketData','ticket')
        .where('refund.id= :id', { id: id })
        .getOne();

        return refund;
    }
    async pgCallback(id){
        return await this.repositoryRefund.findOne({
            where:{
                id:id
            },
            select:{
                pgCallback:true
            }
        });
    }

    async refundDetail(id){
        return await this.repositoryRefund.findOne({
            where:{
                id:id
            },
            relations:{
                refundDetail:{
                    ticketData:true
                }
            }
        });
    }



    async retryDisbursement(refundId){
        try{

            let tryCount = await this.configurationService.findByConfigName("REFUND_TRY_COUNT")
            let config = 1;
            if(tryCount){
                config=parseInt(tryCount.configValue);
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
            let retryAttempt = check.retryAttempt?check.retryAttempt.length:0;
            if(failAttempt==retryAttempt){
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

            let xendit = await this.yggdrasilService.refund(payloadDisbursement)
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
            console.log(e);
            throw new Error(e.message)
        }
    }

    async refundLog(columns){
        try{
            let qb = await this.repositoryRefundLog.createQueryBuilder('refundLog');
            if(columns){
                for(let row of columns){
                    let search = row.search.value;
                    let index = row.data;
                    if(search!=''){
                        if(listTypeLog[index]=="string"){
                            qb.andWhere(`"${fieldLog[index]}" iLike '%${search}%'`)
                        }else if(listTypeLog[index]=="fixed"){
                            qb.andWhere(`"${fieldLog[index]}" = '${search}'`)
                        }else if(listTypeLog[index]=='number'){
                            qb.andWhere(`"${fieldLog[index]}" = '${search}'`)
                        }else if(listTypeLog[index]=='enum'){
                            let statusSearch = await this.searchRefundStatus.get(search.toLowerCase());
                            qb.andWhere(`"${fieldLog[index]}" = '${statusSearch}'`)
                        }else if(listTypeLog[index]=='json'){
                            qb.andWhere(`${fieldLog[index]} = '${search}'`)
                        }else{
                            let date = moment.tz(search, 'DD-MM-YYYY', 'Asia/Jakarta');
                            let startDate = date.toISOString();
                            let endDate = date.add(1, 'day').toISOString();
                            qb.andWhere(`"${fieldLog[index]}" BETWEEN '${startDate}' AND '${endDate}'`)
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

    async #getXenditToken(){
        const pgData = await this.coreService.send({ cmd: 'get-payment-gateway-like-name' },{pgName:'xendit'}).toPromise();
        const credentialData = JSON.parse(pgData.credential);
        // console.log(credentialData);
        const credential = credentialData[await this.configService.get('nodeEnv')];
        return credential
    }
}
