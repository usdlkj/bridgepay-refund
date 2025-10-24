import { Injectable,Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { Refund,RefundStatus } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { ConfigurationService } from 'src/configuration/configuration.service';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import {  Repository,IsNull, Not } from 'typeorm';
import axios from 'axios';

@Injectable()
export class RefundService {
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

        private configurationService: ConfigurationService,
        
        private yggdrasilService : YggdrasilService
    
      ) {
        this.env = getEnv(this.configService);
      }

    
      async create(payload){
        try{
            let result;
            let ticketingCall;
            if(payload.hasOwnProperty("ticketCall")&& payload.ticketCall==0){
            ticketingCall=0;
            }else{
            ticketingCall=1;
            }
            let credential = await this.#getXenditToken();
            let check = await this.repositoryRefund.findOne({
                where:{
                    refundId:payload.reqData.invoice.orderId
                }
            })
            if(check){
                throw new Error("Duplicate Request")
            }
            let checkBank = await this.repositoryRefundBank.findOne({
                where:{
                    xenditCode:payload.reqData.account.bankId,
                    bankStatus:"enable"
                }
            })
            if(!checkBank){
                throw new Error(payload.reqData.account.bankId+" : Bank code not found")
            
            }
            let refundBankData={
                bankName:payload.reqData.account.name,
                bankNumber:payload.reqData.account.accountNo,
                bankCode:payload.reqData.account.bankId,
            }

            let refundAmountData = await this.helper.totalAmountDisbursement(payload.reqData.invoice.refundAmount);

            let payloadSave = {
                refundId:payload.reqData.invoice.orderId,
                refundData:payload,
                refundStatus:ticketingCall==1?RefundStatus.PENDINGCHECKING:RefundStatus.RBDAPPROVAL,
                refundAmount:payload.reqData.invoice.refundAmount,
                refundReason:payload.reqData.invoice.reason,
                refundBankData:refundBankData,
                refundAmountData:refundAmountData,
                createdAt:moment().toISOString(),
                updatedAt:moment().toISOString()
                
            }
            let create = await this.repositoryRefund.save(payloadSave);
            //call ticketing
            let reqData={
                languageCode:"id_ID",
                refundId:payload.reqData.invoice.orderId
            }
            let signDetail = await this.helper.sign(JSON.stringify(reqData));
            let payloadDetail ={
                reqData,
                signMsg:signDetail
            }
            let dataDetail
            if(ticketingCall==1){

                dataDetail = await axios({
                    url:process.env.TICKETING_API_BASE_URL+"/payplat/bank/queryRefundTicketInfo",
                    method:"post",
                    data:payloadDetail
                })
                if(dataDetail.data.retCode!="0"){
                    throw new Error("Fail get Data from ticketing with message : "+dataDetail.data.retMsg);
                }
            }
            //end call ticketing
            //save ticketing Data
            if(ticketingCall==1){
                let rowData = dataDetail.data.retData;
                let detailTicketing = {
                    email:rowData.email,
                    phoneNumber:rowData.phoneNumber,
                    reason:rowData.reason,
                    refundAmount:rowData.refundAmount,
                    refundId:rowData.refundId,
                    ticketOffice:rowData.ticketOffice,
                    refundMwId:create.id.toString(),
                    createdAt:moment().toISOString(),
                    updatedAt:moment().toISOString()

                }
                let saveDetail = await this.repositoryRefundDetail.save(detailTicketing)
                let listTicket=[];
                for(let i=0;i<rowData.tickets.length;i++){
                    let dataTicket = rowData.tickets[i];
                    let ticket = {
                        arrivalStation:dataTicket.arrivalStation,
                        carsNumber:dataTicket.carsNumber,
                        departureDate:dataTicket.departureDate,
                        departureStation:dataTicket.departureStation,
                        identityNumber:dataTicket.identityNumber,
                        identityType:dataTicket.identityType,
                        name:dataTicket.name,
                        orderNumber:dataTicket.orderNumber,
                        purchasePrice:dataTicket.purchasePrice,
                        seatNumber:dataTicket.seatNumber,
                        ticketClass:dataTicket.ticketClass,
                        ticketNumber:dataTicket.ticketNumber,
                        refundDetailId:saveDetail
                    }
                    let saveTicket = await this.repositoryRefundDetailTicket.save(ticket);
                    listTicket.push(saveTicket);
                }
                let updateDetail = await this.repositoryRefundDetail.update(saveDetail.id,{
                    ticketData:listTicket
                });
                let updateRefund = await this.repositoryRefund.update(create.id,{
                    refundDetail:saveDetail
                });
            }
            //end save ticketing

            //create payload
            let invoice = {}
            invoice["orderId"]=payload.reqData.invoice.orderId
            invoice["status"]=await this.helper.statusWording("rbdApproval")
            //end create payload

            if(create){
                let refundDelay=0;
                
                let delayConfig = await this.configurationService.findByConfigName("REFUND_DELAY");
                if(delayConfig){
                    refundDelay=parseInt(delayConfig.configValue)
                }
                if(refundDelay<=0){
                    let refund = await this.repositoryRefund.findOne({
                        where:{
                            refundId:payload.reqData.invoice.orderId
                        }
                    })
                    
                    const {requestData,payloadRefund} = await this.#generateXenditRefundPayload(refund);
                    
                    await this.repositoryRefund.update(refund.id,{
                        requestData:requestData
                    })

                    let payloadDisbursement ={
                        provider:"xendit",
                        func:"disbursement",
                        data:payloadRefund,
                        token:credential.secretKey
                    }

                    let xendit = await this.yggdrasilService.refund(payloadDisbursement);
                    if(xendit.status==200){
                    result ={
                        status:200,
                        message:"Success"
                    }
                    await this.repositoryRefund.update(refund.id,{refundStatus:RefundStatus.PENDINGDISBURSEMENT})
                    invoice["status"]=await this.helper.statusWording("pendingDisbursement")
                    }else{            
                        throw new Error("Failed Xendit disbursement")
                    }
                }else{
                    let addedDate;
                    if(refundDelay>30){
                        addedDate=30
                    }else{
                        addedDate=refundDelay
                    }

                    let refundSchedule=moment().add(addedDate,"d").toISOString();
                    await this.repositoryRefund.update(create.id,{refundStatus:RefundStatus.PENDINGDISBURSEMENT,targetRefundDate:refundSchedule})
                    invoice["status"]=await this.helper.statusWording("pendingDisbursement")
                }
                let sign = await this.helper.sign(JSON.stringify({invoice:invoice}));
                result ={
                    retCode:0,
                    retMsg:"Success",
                    retData:{
                        invoice
                    },
                    signMsg:sign
                }
                return result;
            }else{
                throw new Error("Fail to save data");
            }

        }catch(e){
            let logPayload = {
                type:"api",
                location:"/api/v2/transfer",
                detail:JSON.stringify(e),
                msg:e.message,
                notes:payload.reqData.invoice.orderId
            }
            let result = {
                retCode: -1,
                retMsg: e.message,
            }
            return result;
        }
        
      }

      async status(payload){
        try{

            let credential = await this.#getXenditToken();

            let check = await this.repositoryRefund.findOne({
                where:{
                    refundId:payload.reqData.orderId
                }
            })

            if(!check){
                throw new Error("Refund not found")

            }
            let jsonData= check.refundData;
            let balancePayload={
                provider:"xendit",
                func:"get-balance",
                token:credential.secretKey
            }
            let balance = await this.yggdrasilService.refund(balancePayload)
            let invoice = {}
            
            //create payload
            let lastIdx = check.pgCallback?check.pgCallback.length-1:0;
            invoice["balance"]=balance.data.balance
            invoice["bankCode"]=jsonData.reqData.account.bankId
            if(check.refundStatus.toLowerCase()=="success" || check.refundStatus.toLowerCase()=="done"){
                invoice["bankNo"]=check.pgCallback[lastIdx].pgCallback.id
            }
            if(check.rejectReason!=null){
                invoice["comment"]=check.rejectReason
            }
            invoice["curType"]="360"
            invoice["fee"]=process.env.DISBURSEMENT_FEE_FIX
            invoice["mwNo"]=check.id
            invoice["orderId"]=jsonData.reqData.invoice.orderId
            invoice["pgCode"]="xendit"
            invoice["rate"]=process.env.DISBURSEMENT_FEE_FIX
            invoice["refundAmount"]=check.refundAmount
            invoice["status"]=await this.helper.statusWording(check.refundStatus)
            if(check.refundStatus.toLowerCase()==RefundStatus.SUCCESS || check.refundStatus.toLowerCase()==RefundStatus.DONE){
                invoice["tradeTime"]=moment(check.pgCallback[lastIdx].pgCallback.updated).tz("Asia/Jakarta").format("YYYYMMDDHHMMSS")
            }
            //end create payload
            let sign = await this.helper.sign(JSON.stringify({invoice:invoice}));
            let result ={
                retCode:0,
                retData:{
                invoice
                },
                retMsg:"success",
                signMsg:sign
            }
          return result
        }catch(e){
            let result = {
                retCode: -1,
                retMsg: e.message,
            }
            return result;
        }
      }

      async bankList(){
        try{
            let bankList = await this.repositoryRefundBank.find({
                where:{
                    bankStatus:'enable',
                    ilumaCode:Not(IsNull())
                }
            })
            let data=[];
            bankList.map(function(value,index){
                let temp ={
                    code:value.xenditCode,
                    name:value.bankName
                }
                data.push(temp)
            });
            let result ={
                retCode:0,
                retData:data,
                retMsg:"success"
            }
            return result
        }catch(e){
            let result = {
                retCode: -1,
                retMsg: e.message,
            }
            return result;
        }
      }

      async generateXenditRefundPayload(refund:Object){
        return await this.#generateXenditRefundPayload(refund);
      }  

      async #getXenditToken(){
        const pgData = await this.coreService.send({ cmd: 'get-payment-gateway-like-name' },{pgName:'xendit'}).toPromise();
        const credentialData = JSON.parse(pgData.credential);
        // console.log(credentialData);
        const credential = credentialData[await this.configService.get('nodeEnv')];
        return credential
      }
      

      async #generateXenditRefundPayload(refund){
        let refundData = refund.refundData;
        let refundBankData = refund.refundBankData;
        let refundAmountData = refund.refundAmountData;
        let sequence = refund.retryAttempt?refund.retryAttempt.length:0;
        let refundId
            if(sequence >0){
            refundId= refund.refundId+"-"+sequence;
        }else{
            refundId=refund.refundId;
        }

        let payloadRefund ={
            external_id:refundId,
            amount:refundAmountData.amount,
            bank_code:refundBankData.bankCode,
            account_holder_name:refundBankData.bankName,
            account_number:refundBankData.bankNumber,
            description:refundData.reqData.invoice.reason,

            idempotencyKey:null
        }

        let countCall=refund.pgCallback?refund.pgCallback.length:0;
        let retryCode= ('00' + ((countCall*1)+1)).slice(-3)
        let idempotencyKey = refund.refundId+"-"+retryCode

        payloadRefund.idempotencyKey=idempotencyKey;

        let requestXenditData = payloadRefund;
        requestXenditData.idempotencyKey = idempotencyKey;
        let requestData = refund.requestData?refund.requestData:[];
        requestData.push(requestXenditData);
        return{
            requestData:requestData,
            payloadRefund:payloadRefund
        }
      }
}
