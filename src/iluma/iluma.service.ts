import { Injectable,Inject,HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entity';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { ClientProxy } from '@nestjs/microservices';
import { BrokerModule } from 'src/broker/broker.module';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import * as moment from 'moment-timezone';


@Injectable()
export class IlumaService {

private env: string;

  constructor(
    private helper:Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,

    @InjectRepository(IlumaCallLog)
    private repositoryCallLog: Repository<IlumaCallLog>,

    @InjectRepository(IlumaCallback)
    private repositoryCallback: Repository<IlumaCallback>,

    private readonly configService: ConfigService,

    private readonly yggdrasilService: YggdrasilService

  ) {
    this.env = getEnv(this.configService);
  }

  async checkAccount(payload){
        let accountName=null;
        let result;
        let ilumaCode = await this.repositoryRefundBank.findOne({
        where:{
            xenditCode:payload.reqData.account.bankId
        }
    })
    if(!ilumaCode){
        result = {
          retCode: -1,
          retMsg: "Bank code not found",
        }
        return result;
    }

    let bankData ={
         bank_account_number:payload.reqData.account.accountNo,
         bank_code:"ID_"+ilumaCode.ilumaCode
    }
    let payloadValidator ={
        provider:"iluma",
        func:"bank-validator",
        data:bankData,
        credential:this.configService.get('ilumaToken')
    }
    let checkIluma = await this.yggdrasilService.refund(payloadValidator)
    if(checkIluma.status!=200){
        result = {
          retCode: -1,
          retMsg: checkIluma.msg,
        }
        return result;
    }
    let payloadLog = {
        url:"https://api.iluma.ai/v1.2/identity/bank_account_validation_details",
        payload:bankData,
        method:"post",
        response:checkIluma.data
    }
    await this.repositoryCallLog.save(payloadLog);
    let status;
    if(checkIluma.data.status.toLowerCase()=="pending"){
        let ilumaPayload = {
           callbackType:"BANK_NAME_VALIDATOR_DETAILS",
           requestNumber:checkIluma.data.id,
           payload:checkIluma,
           createdAt:moment().toISOString(),
            updatedAt:moment().toISOString()
   
        
        }
        
        let ilumaReq = await this.repositoryCallback.save(ilumaPayload);
        if(!ilumaReq){
            result = {
                retCode: -1,
                retMsg: "Fail save iluma Callback Data",
            }
            return result;``
        }
        status = "pending"
        let flag=0;
        while(flag<3){
            let sleep = await this.helper.sleep(10000)
            let payloadGetResult ={
                provider:"iluma",
                func:"get-result",
                requestId:checkIluma.data.id,
                credential:process.env.ILUMA_TOKEN
            }
            let check = await this.coreService.send({cmd:"refund-core-service"},payloadGetResult).toPromise();
            let payloadLog = {
                url:"https://api.iluma.ai/v1.2/identity/bank_account_validation_details/"+checkIluma.data.id+"",
                payload:checkIluma.data.id,
                method:"post",
                response:check
            }
            await this.repositoryCallLog.save(payloadLog);
            if(check.data.status.toLowerCase()=="completed" && check.data.result.is_found==true && check.data.result.is_virtual_account==false){
                status="success"
                accountName=check.data.result.account_holder_name;
                flag=3;
            }else if(check.data.status.toLowerCase()=="pending"){
                flag++;
            }else{
                status="failed"
                flag=3;
            }

        }

    }else if(checkIluma.data.status.toLowerCase()=="completed" && checkIluma.data.result.is_found==true && checkIluma.data.result.is_virtual_account==false){
        status= "success"
        accountName=checkIluma.data.result.account_holder_name;
    }else{
        status="failed",
        accountName=null;
    
    }
    let sign = await this.helper.sign(JSON.stringify({status}));
    result ={
        retCode:0,
        message:"Success",
        retData:{
        status
        },
        signMsg:sign
    }
    return result;
    
  }

  async ilumaBankValidator(data){
    try{
        let _where={
            where:{
                requestNumber:data.id
            }
        }
        let check = await this.repositoryCallback.findOne(_where);
        if(check){
        let payload = {
            response:data,
            responseAt:moment().format("YYYY-MM-DD HH:mm:ss"),
            updatedAt:moment().toISOString()
        }
        let responseLog = await this.repositoryCallback.update(check.id,payload);
        // if(data.result.is_found==true){
        //     let payAccount={
        //         refundId:check.refundId,
        //         refundBankData:ctx.params
        //     }
        //     var updatePayAccount = await ctx.call("ilumaCallback-model.update",payload);
        // }
        }else{
            throw new Error("Request Number not found");
        }
        return {message:"OK"}
    }catch(e){
        throw new HttpException({status:500,message:"failed handle webhook"}, HttpStatus.INTERNAL_SERVER_ERROR) 
    }
  }

}
