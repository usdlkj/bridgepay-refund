import { Injectable,HttpException, HttpStatus } from '@nestjs/common';
import { getEnv, isDevOrTest, getCredentialForEnv } from '../utils/env.utils';
import { ConfigService } from '@nestjs/config';
import { Report,reportType } from './entities/report.entity';
import { Refund,RefundStatus } from 'src/refund/entities/refund.entity';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import {  Repository,IsNull, Not,Brackets } from 'typeorm';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportDataRow } from './entities/report-data-row.entity';
import { IlumaCallLog } from 'src/iluma/entities/iluma-call-log.entity';
const listType =['string',"json","number","date","enum","date"];
const field=["refund_id","refund_data->'reqData'->'account'->>'name'","refund_amount","created_at",'refund_status','refund_date']

@Injectable()
export class ReportService {
    private env: string;
    constructor(
        @InjectRepository(Report)
        private repositoryReport: Repository<Report>,

        @InjectRepository(Refund)
        private repositoryRefund: Repository<Refund>,
        
         @InjectRepository(ReportDataRow)
        private repositoryReportDataRow: Repository<ReportDataRow>,

        @InjectRepository(IlumaCallLog)
        private repositoryIlumaCallLog: Repository<IlumaCallLog>,

         private readonly configService: ConfigService,
    ){
        this.env = getEnv(this.configService);
    }

    async list(columns){
        try{
            let qb = await this.repositoryReport.createQueryBuilder('report');
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

    async create(createReportDto:CreateReportDto){
        try{
            let type = createReportDto.type
            let name = type+moment(createReportDto.date).format("DDMMYYYY");
            //end create name
            let startDate = moment(createReportDto.date+" 00:00:00").toISOString();
            let endDate = moment(createReportDto.date+" 23:59:59").toISOString()
            let payload={
                refundStartDate:startDate,
                refundEndDate:endDate,
                reportType:createReportDto.type,
                name:name,
                createdAt:moment().toISOString(),
                updatedAt:moment().toISOString()
            }
            let save = await this.repositoryReport.save(payload);
            if(type=="refund"){
              this.#refundReportGenerate(save)
            }else{
              this.#ilumaReportGenerate(save)
            //   ctx.call("report-service.ilumaReportGenerate",save);
            }
            return save
        }catch(e){
             throw new HttpException({status:500,message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
    }

    async #refundReportGenerate(report){
        try{
            let data = await this.repositoryRefund.createQueryBuilder("refund")
            .leftJoinAndSelect("refund.refundDetail","refundDetail")
            .where(new Brackets(qb=>{
                qb.where(`refund.refundStatus='success'`)
                .orWhere(`refund.refundStatus='done'`)
            
            }))
            .andWhere(`refund.created_at between '${report.refundStartDate}' and '${report.refundEndDate}'`)
            .getMany()


            if(data.length<0){
                await this.repositoryReport.update(report.id,{
                    reportStatus:"completed",
                    reportData:[]
                })
            }else{
                let refundData=[]
                let no =1;
                for(let refund of data){
                    let ticketData = null
                    if(refund.refundDetail){
                        ticketData=refund.refundDetail
                    }
                    let row={
                        seqNo:no,
                        refundDate:moment(refund.createdAt).tz("Asia/Jakarta").format("DDMMYYYY"),
                        cancelTime:moment(refund.createdAt).tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss"),
                        refundType:"-",
                        refundPerson:ticketData!=null?ticketData.name:"-",
                        refundCharge:refund.refundAmountData.fee,
                        refundChargeTax:refund.refundAmountData.tax,
                        refundAmount:refund.refundAmount,
                        refundTrandeNo:refund.refundId,
                        PlatTradeNo:"-",
                        refundBankCode:refund.refundBankData.bankCode,
                        refundBankName:"-",
                        refundAccount:refund.refundBankData.bankNumber,
                        refundAccountName:refund.refundBankData.bankName,
                        ActualRefundAmount:refund.refundAmountData.totalAmount,
                        PassengerName:ticketData!=null?ticketData.name:"-",
                        encryptedIdNumber:ticketData!=null?ticketData.identityNumber:"-",
                        nationality:"-",
                        orderNumber:ticketData!=null?ticketData.orderNumber:"-",
                        ticketNo:ticketData!=null?ticketData.ticketNumber:"-",
                        ticketingStation:"-",
                        businessArea:"-",
                        officeNo:"-",
                        windowNo:"-",
                        shiftNo:"-",
                        operatorName:"-",
                        ticketingTime:"-",
                        departureTime:ticketData!=null?moment(ticketData.departureDate,"YYYYMMDDHHmm","Asia/Jakarta").format("DD/MM/YYYY"):"-",
                        trainNo:"-",
                        origin:ticketData!=null?ticketData.departureStation:"-",
                        carsNumber:ticketData!=null?ticketData.carsNumber:"-",
                        seatNumber:ticketData!=null?ticketData.seatNumber:"-",
                        originCode:"-",
                        purchaseDate:"-",
                        destination:ticketData!=null?ticketData.arrivalStation:"-",
                        destinationCode:"-",
                        arrivalTime:"-",
                        seatClass:ticketData!=null?ticketData.ticketClass:"-",
                        ticketType:"-",
                        originalTicketPrice:ticketData!=null?ticketData.purchasePrice:"-"
                    }
                    await this.repositoryReportDataRow.save(row)
                    refundData.push(row)
                    no++;
                }
                await this.repositoryReport.update(report.id,{
                    reportStatus:"completed",
                    reportData:refundData
                })
            }
        }catch(e){
            throw new HttpException({message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }
    }

    async #ilumaReportGenerate(report){
        try{
            let data = await this.repositoryIlumaCallLog.createQueryBuilder("ilumaCallLog")
            .andWhere(`ilumaCallLog.created_at between '${report.refundStartDate}' and '${report.refundEndDate}'`)
            .getMany()


            if(data.length<0){
                await this.repositoryReport.update(report.id,{
                    reportStatus:"completed",
                    reportData:[]
                })
            }else{
                let logData=[]
                for(let log of data){
                    let row={
                        endPoint:log.url,
                        method:log.method,
                        callData:moment(log.createdAt).tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")
                    }
                    logData.push(row);
                }
                await this.repositoryReport.update(report.id,{
                    reportStatus:"completed",
                    reportData:logData
                })
            }
        }catch(e){
            throw new HttpException({message:e.message}, HttpStatus.INTERNAL_SERVER_ERROR) 
        }

    }

    async downloadExcel(id: string) {
        try {
        const report = await this.repositoryReport.findOneBy({ id: parseInt(id) });
        if (!report) {
            throw new Error("Report not found");
        }

        const data = report.reportData

        return {
            status: 200,
            title: report.name,
            type:report.reportType,
            data: data
        };
        } catch (e) {
            return {
                status: 500,
                msg: e.message
            };
        }
  }


}
