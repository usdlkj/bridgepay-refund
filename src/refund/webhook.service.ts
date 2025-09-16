import { Injectable,Inject,HttpException,HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { Refund,RefundStatus } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository,IsNull, Not,In } from 'typeorm';
import axios from 'axios';

@Injectable()
export class WebhookService {
    private env: string;
    
      constructor(
        private helper:Helper,
        @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,
    
        @InjectRepository(RefundBank)
        private repositoryRefundBank: Repository<RefundBank>,
    
        @InjectRepository(Refund)
        private repositoryRefund: Repository<Refund>,
    
        @InjectRepository(RefundDetail)
        private repositoryRefundDetail: Repository<RefundDetail>,

        @InjectRepository(RefundDetailTicket)
        private repositoryRefundDetailTicket: Repository<RefundDetailTicket>,
    
        private readonly configService: ConfigService,
    
      ) {
        this.env = getEnv(this.configService);
      }

      async xendit(data,callbackToken:string){
        try{
            let credential = await this.#getXenditToken();
            if (callbackToken == credential.callbackToken) {
                var explode= data.external_id.split("-");
                var refundId=explode[0];
                const _where ={
                    where:{
                        refundId:refundId,
                        refundStatus:In(["pendingDisbursement","retry"])
                    }
                }
                let check = await this.repositoryRefund.findOne(_where);
                if(check){
                    let failCode = null
                    if(data.status.toLowerCase()=='failed'){
                        failCode = data.failure_code;
                    } 
                    //pgCallback
                    let pgCallback = check.pgCallback?check.pgCallback:[];
                    let payload = {
                        pgSource:"xendit",
                        callbackStatus:data.status.toLowerCase(),
                        failCode:failCode,
                        pgCallback:data,
                        createdAt:moment().format("YYYY-MM-DD HH:mm:ss")
                    }
                    pgCallback.push(payload);
                    //end pgCallback

                    //get balance data
                    let balancePayload={
                        provider:"xendit",
                        func:"get-balance",
                        token:credential.secretKey
                    }
                    let balance = await this.coreService.send({cmd:'refund-core-service'},balancePayload).toPromise();
                    //end get balance data

                    if(data.status.toLowerCase()=="completed"){
                        let refundDate = moment().format("YYYY-MM-DD HH:mm:ss")
                        await this.repositoryRefund.update(check.id,{
                            refundStatus:RefundStatus.SUCCESS,
                            pgCallback:pgCallback,
                            refundDate:refundDate,
                            updatedAt:moment().toISOString()
                        })
                        
                        //generate payload
                        let payload = {}
                        payload["balance"]=balance.data.balance
                        payload["bankCode"]=""+check.refundData.reqData.account.bankId+""
                        payload["bankNo"]=""+check.refundData.reqData.account.accountNo+""
                        payload["curType"]="360"
                        payload["fee"]=check.refundAmountData.fee;
                        payload["mwNo"]=""+check.id+""
                        payload["orderId"]=""+check.refundId+""
                        payload["pgCode"]="xendit"
                        payload["rate"]="0%+"+check.refundAmountData.fee+"", 
                        payload["refundAmount"]=check.refundAmountData.amount
                        payload["status"]=""+await this.helper.statusWording("success")+""
                        payload["tradeTime"]=""+moment(data.updated).tz("Asia/Jakarta").format("YYYYMMDDHHmmss")+""
                        let sign = await this.helper.sign(JSON.stringify({payload}));
                        let tickectingPayload ={
                            retData:payload,
                            signMsg:sign
                        }
                        //end generate payload
                        await this.#notifTicketing(check.refundData,tickectingPayload,check.id,check.notifLog,"success");
                        
                    }else if(data.status.toLowerCase()=="pending"){
                        await this.repositoryRefund.update(check.id,{
                            pgCallback:pgCallback,
                            updatedAt:moment().toISOString()
                        })
                    }else{
                        if(data.failure_code.toUpperCase()=="INVALID_DESTINATION"||data.failure_code.toUpperCase()=="REJECTED_BY_BANK"||data.failure_code.toUpperCase()=="TRANSFER_ERROR"||data.failure_code.toUpperCase()=="EMPTY_ACCOUNT_NAME"||data.failure_code.toUpperCase()=="REJECTED_BY_CHANNEL"){
                            let payload ={}
                            let payloadSign={}
                            
                            payload["balance"]=balance.data.balance
                            payload["bankCode"]=""+check.refundData.reqData.account.bankId+""
                            payload["bankNo"]=""+check.refundData.reqData.account.accountNo+""
                            payload["curType"]="360"
                            payload["fee"]=""
                            payload["mwNo"]=""+check.id+""
                            payload["orderId"]=""+check.refundId+""
                            payload["pgCode"]=""
                            payload["rate"]="", 
                            payload["refundAmount"]=check.refundAmountData.amount
                            payload["status"]=""+await this.helper.statusWording("fail")+""
                            payload["tradeTime"]=""


                            payloadSign["balance"]=balance.data.balance
                            payloadSign["bankCode"]=""+check.refundData.reqData.account.bankId+""
                            payloadSign["bankNo"]=""+check.refundData.reqData.account.accountNo+""
                            payloadSign["curType"]="360"
                            payloadSign["mwNo"]=""+check.id+""
                            payloadSign["orderId"]=""+check.refundId+""
                            payloadSign["refundAmount"]=check.refundAmountData.amount
                            payloadSign["status"]=""+await this.helper.statusWording("fail")+""
                            let sign = await this.helper.sign(JSON.stringify(payloadSign));
                            let tickectingPayload={
                                retData:payload,
                                signMsg:sign
                            }
                            await this.#notifTicketing(check.refundData,tickectingPayload,check.id,check.notifLog,"fail",pgCallback);
                        }else{
                            let whereConfig = {
                                configName: "REFUND_TRY_COUNT"
                            }
                            let tryCount = await this.coreService.send({cmd:'get-config-data'},whereConfig).toPromise();
                            console.log(tryCount);
                            let config = 1;
                            if(tryCount){
                                config=tryCount.configValue;
                            }
                            let failAttempt = config ||  1
                            let retryAttempt= check.retryAttempt?check.retryAttempt.length:0;
                            if(failAttempt == retryAttempt){
                                let payload ={}
                                let payloadSign={}
                                
                                payload["balance"]=balance.data.balance
                                payload["bankCode"]=""+check.refundData.reqData.account.bankId+""
                                payload["bankNo"]=""+check.refundData.reqData.account.accountNo+""
                                payload["curType"]="360"
                                payload["fee"]=""
                                payload["mwNo"]=""+check.id+""
                                payload["orderId"]=""+check.refundId+""
                                payload["pgCode"]=""
                                payload["rate"]="", 
                                payload["refundAmount"]=check.refundAmountData.amount
                                payload["status"]=""+await this.helper.statusWording("fail")+""
                                payload["tradeTime"]=""


                                payloadSign["balance"]=balance.data.balance
                                payloadSign["bankCode"]=""+check.refundData.reqData.account.bankId+""
                                payloadSign["bankNo"]=""+check.refundData.reqData.account.accountNo+""
                                payloadSign["curType"]="360"
                                payloadSign["mwNo"]=""+check.id+""
                                payloadSign["orderId"]=""+check.refundId+""
                                payloadSign["refundAmount"]=check.refundAmountData.amount
                                payloadSign["status"]=""+await this.helper.statusWording("fail")+""
                                let sign = await this.helper.sign(JSON.stringify(payloadSign));
                                let tickectingPayload={
                                    retData:payload,
                                    signMsg:sign
                                }
                                await this.#notifTicketing(check.refundData,tickectingPayload,check.id,check.notifLog,"fail",pgCallback);
                            }else{
                                let whereConfigTryPeriod = {
                                    configName: "⁠REFUND_TRY_TIME_PERIOD"
                                }
                                let tyrPeriod = await this.coreService.send({cmd:'get-config-data'},whereConfigTryPeriod).toPromise();
                                let configTryPeriod = 10;
                                if(tyrPeriod){
                                    configTryPeriod=tyrPeriod.configValue;
                                }

                                if(configTryPeriod< 10){
                                    configTryPeriod=60;
                                }
                                let retryDate =moment().add((configTryPeriod),"m").toISOString();
                                await this.repositoryRefund.update(check.id,{
                                    refundStatus:RefundStatus.FAIL,
                                    pgCallback:pgCallback,
                                    retryDate:retryDate,
                                })

                            }
                        }
                        
                    }
                    return { message: "OK" } 
                }else{
                    throw new Error("refundId not found")
                }
            }else{
                throw new Error("Callback Token mismatch")
            }
        }catch(e){
            console.log(e);
            throw new HttpException({status:500,message:"failed handle webhook"}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
      }

      async #getXenditToken(){
        const pgData = await this.coreService.send({ cmd: 'get-payment-gateway-like-name' },{pgName:'xendit'}).toPromise();
        const credentialData = JSON.parse(pgData.credential);
        // console.log(credentialData);
        const credential = credentialData[await this.configService.get('nodeEnv')];
        return credential
      }

      async #notifTicketing(refundData,payload,refundId,notifLogData,type:"success" | "fail",pgCallback=null){
        //notif ticketing
        let notifDate=moment().format("YYYY-MM-DD HH:mm:ss");
        let notif = await axios({
            url:refundData.reqData.invoice.notifyUrl,
            method:"post",
            data:payload
        })
        let responseAt=moment().format("YYYY-MM-DD HH:mm:ss");
        let notifLog= notifLogData?notifLogData:[];
        let notifLogPayload={
            payload:payload,
            initAt:notifDate,
            responseData:notif.data,
            responseAt:responseAt,
        }
        notifLog.push(notifLogPayload);
        let payloadNotif={
            notifLog:notifLog,
            updatedAt:moment().toISOString()
        }
        if(type == "success"){
            console.log(notif)
            // console.log(notif.status);
            if((notif.status==200 || notif.status==201) && notif.data.retCode==0){
                payloadNotif["refundStatus"]=RefundStatus.DONE
            }
            console.log(payloadNotif)
            await this.repositoryRefund.update(refundId,payloadNotif)
        }else {
            payloadNotif["refundStatus"]=RefundStatus.FAIL
            payloadNotif["pgCallback"]=pgCallback
            await this.repositoryRefund.update(refundId,payloadNotif)

        }
        //end notif ticketing
      }
}
