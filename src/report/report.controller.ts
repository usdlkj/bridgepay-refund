import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import * as ExcelJS from 'exceljs';

@Controller('/api/v2/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('/')
  async reportList(@Body('query') query) {
    return this.reportService.list(query);
  }

  @Post('/create')
  async createReport(@Body() createReportDto: CreateReportDto) {
    return this.reportService.create(createReportDto);
  }

  @Get('/download/:id')
  async downloadExcel(@Param('id') id: string, @Res() res: Response) {
    const data = await this.reportService.downloadExcel(id);
    if (data.status == 200) {
      const workbook = new ExcelJS.Workbook();
      const title = data.title.replace('.txt', '');
      const worksheet = workbook.addWorksheet(title);
      if (data.type == 'refund') {
        worksheet.columns = [
          { header: 'seqNo', key: 'seqNo' },
          { header: 'refundDate', key: 'refundDate' },
          { header: 'cancelTime', key: 'cancelTime' },
          { header: 'refundType', key: 'refundType' },
          { header: 'refundPerson', key: 'refundPerson' },
          { header: 'refundCharge', key: 'refundCharge' },
          { header: 'refundChargeTax', key: 'refundChargeTax' },
          { header: 'refundAmount', key: 'refundAmount' },
          { header: 'refundTrandeNo', key: 'refundTrandeNo' },
          { header: 'PlatTradeNo', key: 'PlatTradeNo' },
          { header: 'refundBankCode', key: 'refundBankCode' },
          { header: 'refundBankName', key: 'refundBankName' },
          { header: 'refundAccount', key: 'refundAccount' },
          { header: 'refundAccountName', key: 'refundAccountName' },
          { header: 'ActualRefundAmount', key: 'ActualRefundAmount' },
          { header: 'PassengerName', key: 'PassengerName' },
          { header: 'encryptedIdNumber', key: 'encryptedIdNumber' },
          { header: 'nationality', key: 'nationality' },
          { header: 'orderNumber', key: 'orderNumber' },
          { header: 'ticketNo', key: 'ticketNo' },
          { header: 'ticketingStation', key: 'ticketingStation' },
          { header: 'businessArea', key: 'businessArea' },
          { header: 'officeNo', key: 'officeNo' },
          { header: 'windowNo', key: 'windowNo' },
          { header: 'shiftNo', key: 'shiftNo' },
          { header: 'operatorName', key: 'operatorName' },
          { header: 'ticketingTime', key: 'ticketingTime' },
          { header: 'departureTime', key: 'departureTime' },
          { header: 'trainNo', key: 'trainNo' },
          { header: 'origin', key: 'origin' },
          { header: 'carsNumber', key: 'carsNumber' },
          { header: 'seatNumber', key: 'seatNumber' },
          { header: 'originCode', key: 'originCode' },
          { header: 'purchaseDate', key: 'purchaseDate' },
          { header: 'destination', key: 'destination' },
          { header: 'destinationCode', key: 'destinationCode' },
          { header: 'arrivalTime', key: 'arrivalTime' },
          { header: 'seatClass', key: 'seatClass' },
          { header: 'ticketType', key: 'ticketType' },
          { header: 'originalTicketPrice', key: 'originalTicketPrice' },
        ];
        const reportData = data.data;
        for (const row of reportData) {
          worksheet.addRow({
            seqNo: row.seqNo,
            refundDate: row.refundDate,
            cancelTime: row.cancelTime,
            refundType: row.refundType,
            refundPerson: row.refundPerson,
            refundCharge: row.refundCharge,
            refundChargeTax: row.refundChargeTax,
            refundAmount: row.refundAmount,
            refundTrandeNo: row.refundTrandeNo,
            PlatTradeNo: row.PlatTradeNo,
            refundBankCode: row.refundBankCode,
            refundBankName: row.refundBankName,
            refundAccount: row.refundAccount,
            refundAccountName: row.refundAccountName,
            ActualRefundAmount: row.ActualRefundAmount,
            PassengerName: row.PassengerName,
            encryptedIdNumber: row.encryptedIdNumber,
            nationality: row.nationality,
            orderNumber: row.orderNumber,
            ticketNo: row.ticketNo,
            ticketingStation: row.ticketingStation,
            businessArea: row.businessArea,
            officeNo: row.officeNo,
            windowNo: row.windowNo,
            shiftNo: row.shiftNo,
            operatorName: row.operatorName,
            ticketingTime: row.ticketingTime,
            departureTime: row.departureTime,
            trainNo: row.trainNo,
            origin: row.origin,
            carsNumber: row.carsNumber,
            seatNumber: row.seatNumber,
            originCode: row.originCode,
            purchaseDate: row.purchaseDate,
            destination: row.destination,
            destinationCode: row.destinationCode,
            arrivalTime: row.arrivalTime,
            seatClass: row.seatClass,
            ticketType: row.ticketType,
            originalTicketPrice: row.originalTicketPrice,
          });
        }
      } else {
        worksheet.columns = [
          { header: 'endPoint', key: 'endPoint' },
          { header: 'method', key: 'method' },
          { header: 'callData', key: 'callData' },
        ];
        const reportData = data.data;
        for (const row of reportData) {
          worksheet.addRow({
            endPoint: row.endPoint,
            method: row.method,
            callData: row.callData,
          });
        }
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=' + title + '.xlsx',
      );
      await workbook.xlsx.write(res);
      res.end();
    } else {
      throw new HttpException(data.msg, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
