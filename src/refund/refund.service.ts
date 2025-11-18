import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { RefundLog } from './entities/refund-log.entity';
import { TicketingCallLog } from './entities/ticketing-call-log.entity';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { ConfigurationService } from 'src/configuration/configuration.service';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import axios from 'axios';

@Injectable()
export class RefundService {
  private env: string;

  constructor(
    private helper: Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,

    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,

    @InjectRepository(Refund)
    private repositoryRefund: Repository<Refund>,

    @InjectRepository(RefundDetail)
    private repositoryRefundDetail: Repository<RefundDetail>,

    @InjectRepository(RefundDetailTicket)
    private repositoryRefundDetailTicket: Repository<RefundDetailTicket>,

    @InjectRepository(RefundLog)
    private repositoryRefundLog: Repository<RefundLog>,

    @InjectRepository(TicketingCallLog)
    private repositoryTicketingCallLog: Repository<TicketingCallLog>,

    private readonly configService: ConfigService,

    private configurationService: ConfigurationService,

    private yggdrasilService: YggdrasilService,

    private paymentGatewayService: PaymentGatewayService,
  ) {
    this.env = getEnv(this.configService);
  }

  async create(payload) {
    try {
      let result;
      let ticketingCall;
      if (payload.hasOwnProperty('ticketCall') && payload.ticketCall == 0) {
        ticketingCall = 0;
      } else {
        ticketingCall = 1;
      }

      const credential = await this.#getXenditToken();
      const check = await this.repositoryRefund.findOne({
        where: {
          refundId: payload.reqData.invoice.orderId,
        },
      });
      if (check) {
        throw new Error('Duplicate Request');
      }
      const checkBank = await this.repositoryRefundBank.findOne({
        where: {
          xenditCode: payload.reqData.account.bankId,
          bankStatus: 'enable',
        },
      });
      if (!checkBank) {
        throw new Error(
          payload.reqData.account.bankId + ' : Bank code not found',
        );
      }
      const refundBankData = {
        bankName: payload.reqData.account.name,
        bankNumber: payload.reqData.account.accountNo,
        bankCode: payload.reqData.account.bankId,
      };

      const refundAmountData = await this.helper.totalAmountDisbursement(
        payload.reqData.invoice.refundAmount,
      );

      const payloadSave = {
        refundId: payload.reqData.invoice.orderId,
        refundData: payload,
        refundStatus:
          ticketingCall == 1
            ? RefundStatus.PENDINGCHECKING
            : RefundStatus.RBDAPPROVAL,
        refundAmount: payload.reqData.invoice.refundAmount,
        refundReason: payload.reqData.invoice.reason,
        refundBankData: refundBankData,
        refundAmountData: refundAmountData,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      const payloadSaveCreate = await this.repositoryRefund.create(payloadSave);
      const create = await this.repositoryRefund.save(payloadSaveCreate);
      //call ticketing
      const reqData = {
        languageCode: 'id_ID',
        refundId: payload.reqData.invoice.orderId,
      };
      const signDetail = await this.helper.sign(JSON.stringify(reqData));
      const payloadDetail = {
        reqData,
        signMsg: signDetail,
      };
      let dataDetail;
      if (ticketingCall == 1) {
        dataDetail = await axios({
          url:
            (await this.configService.get('ticketingApiBaseUrl')) +
            '/payplat/bank/queryRefundTicketInfo',
          method: 'post',
          data: payloadDetail,
        });

        const ticketingCallPayload = {
          refundNumber: payload.reqData.invoice.orderId,
          payload: payload,
          response: dataDetail.data,
          createdAt: moment().toISOString(),
          updatedAt: moment().toISOString(),
        };
        const ticketingCallPayloadSave =
          await this.repositoryTicketingCallLog.create(ticketingCallPayload);
        await this.repositoryTicketingCallLog.save(ticketingCallPayloadSave);

        if (dataDetail.data.retCode != '0') {
          throw new Error(
            'Fail get Data from ticketing with message : ' +
              dataDetail.data.retMsg,
          );
        }
      }
      //end call ticketing
      //save ticketing Data
      if (ticketingCall == 1) {
        const rowData = dataDetail.data.retData;
        const detailTicketing = {
          email: rowData.email,
          phoneNumber: rowData.phoneNumber,
          reason: rowData.reason,
          refundAmount: rowData.refundAmount,
          refundId: rowData.refundId,
          ticketOffice: rowData.ticketOffice,
          refundMwId: create.id,
          createdAt: moment().toISOString(),
          updatedAt: moment().toISOString(),
        };
        const detailTicketingSave =
          await this.repositoryRefundDetail.create(detailTicketing);
        const saveDetail =
          await this.repositoryRefundDetail.save(detailTicketingSave);
        const listTicket = [];
        for (let i = 0; i < rowData.tickets.length; i++) {
          const dataTicket = rowData.tickets[i];
          const ticket = {
            arrivalStation: dataTicket.arrivalStation,
            carsNumber: dataTicket.carsNumber,
            departureDate: dataTicket.departureDate,
            departureStation: dataTicket.departureStation,
            identityNumber: dataTicket.identityNumber,
            identityType: dataTicket.identityType,
            name: dataTicket.name,
            orderNumber: dataTicket.orderNumber,
            purchasePrice: dataTicket.purchasePrice,
            seatNumber: dataTicket.seatNumber,
            ticketClass: dataTicket.ticketClass,
            ticketNumber: dataTicket.ticketNumber,
            refundDetailId: saveDetail,
            createdAt: moment().toISOString(),
            updatedAt: moment().toISOString(),
          };
          const ticketSave =
            await this.repositoryRefundDetailTicket.create(ticket);
          const saveTicket =
            await this.repositoryRefundDetailTicket.save(ticketSave);
          listTicket.push(saveTicket);
        }
        await this.repositoryRefundDetail.update(saveDetail.id, {
          ticketData: listTicket,
        });
        await this.repositoryRefund.update(create.id, {
          refundDetail: saveDetail,
        });
      }
      //end save ticketing

      //create payload
      const invoice = {};
      invoice['orderId'] = payload.reqData.invoice.orderId;
      invoice['status'] = await this.helper.statusWording('rbdApproval');
      //end create payload

      if (create) {
        const refund = await this.repositoryRefund.findOne({
          where: {
            refundId: payload.reqData.invoice.orderId,
          },
        });

        const { requestData, payloadRefund } =
          await this.#generateXenditRefundPayload(refund);

        await this.repositoryRefund.update(refund.id, {
          requestData: requestData,
        });

        const payloadDisbursement = {
          provider: 'xendit',
          func: 'disbursement',
          data: payloadRefund,
          token: credential.secretKey,
        };

        const xendit = await this.yggdrasilService.refund(payloadDisbursement);
        if (xendit.status == 200) {
          result = {
            status: 200,
            message: 'Success',
          };
          await this.repositoryRefund.update(refund.id, {
            refundStatus: RefundStatus.PENDINGDISBURSEMENT,
          });
          invoice['status'] = await this.helper.statusWording(
            'pendingDisbursement',
          );
        } else {
          throw new Error('Failed Xendit disbursement');
        }
        const sign = await this.helper.sign(
          JSON.stringify({ invoice: invoice }),
        );
        result = {
          retCode: 0,
          retMsg: 'Success',
          retData: {
            invoice,
          },
          signMsg: sign,
        };
        return result;
      } else {
        throw new Error('Fail to save data');
      }
    } catch (e) {
      const logPayload = {
        type: 'api',
        location: '/api/v2/transfer',
        detail: JSON.stringify(e),
        msg: e.message,
        notes: payload.reqData.invoice.orderId,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      const logPayloadSave = await this.repositoryRefundLog.create(logPayload);
      await this.repositoryRefundLog.save(logPayloadSave);
      const existingRefund = await this.repositoryRefund.findOne({
        where: {
          refundId: payload.reqData.invoice.orderId,
        },
      });
      if (existingRefund) {
        await this.repositoryRefund.update(existingRefund.id, {
          refundStatus: RefundStatus.FAIL,
          rejectReason: e.message,
          updatedAt: moment().toISOString(),
        });
      }
      const result = {
        retCode: -1,
        retMsg: e.message,
      };
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async status(payload) {
    try {
      const credential = await this.#getXenditToken();

      const check = await this.repositoryRefund.findOne({
        where: {
          refundId: payload.reqData.invoice.orderId,
        },
      });

      if (!check) {
        throw new Error('Refund not found');
      }
      const jsonData = check.refundData;
      const balancePayload = {
        provider: 'xendit',
        func: 'get-balance',
        token: credential.secretKey,
      };
      const balance = await this.yggdrasilService.refund(balancePayload);
      const invoice = {};

      //create payload
      const lastIdx = check.pgCallback ? check.pgCallback.length - 1 : 0;
      invoice['balance'] = balance.data.balance;
      invoice['bankCode'] = jsonData.reqData.account.bankId;
      if (
        check.refundStatus.toLowerCase() == 'success' ||
        check.refundStatus.toLowerCase() == 'done'
      ) {
        invoice['bankNo'] = check.pgCallback[lastIdx].pgCallback.id;
      }
      if (check.rejectReason != null) {
        invoice['comment'] = check.rejectReason;
      }
      invoice['curType'] = '360';
      invoice['fee'] = process.env.DISBURSEMENT_FEE_FIX;
      invoice['mwNo'] = check.id;
      invoice['orderId'] = jsonData.reqData.invoice.orderId;
      invoice['pgCode'] = 'xendit';
      invoice['rate'] = process.env.DISBURSEMENT_FEE_FIX;
      invoice['refundAmount'] = check.refundAmount;
      invoice['status'] = await this.helper.statusWording(check.refundStatus);
      if (
        check.refundStatus.toLowerCase() == RefundStatus.SUCCESS ||
        check.refundStatus.toLowerCase() == RefundStatus.DONE
      ) {
        invoice['tradeTime'] = moment(
          check.pgCallback[lastIdx].pgCallback.updated,
        )
          .tz('Asia/Jakarta')
          .format('YYYYMMDDHHMMSS');
      }
      //end create payload
      const sign = await this.helper.sign(JSON.stringify({ invoice: invoice }));
      const result = {
        retCode: 0,
        retData: {
          invoice,
        },
        retMsg: 'success',
        signMsg: sign,
      };
      return result;
    } catch (e) {
      const result = {
        retCode: -1,
        retMsg: e.message,
      };
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bankList() {
    try {
      const bankList = await this.repositoryRefundBank.find({
        where: {
          bankStatus: 'enable',
          ilumaCode: Not(IsNull()),
        },
      });
      const data = [];
      bankList.map(function (value) {
        const temp = {
          code: value.xenditCode,
          name: value.bankName,
        };
        data.push(temp);
      });
      const result = {
        retCode: 0,
        retData: data,
        retMsg: 'success',
      };
      return result;
    } catch (e) {
      const result = {
        retCode: -1,
        retMsg: e.message,
      };
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async generateXenditRefundPayload(refund: object) {
    return await this.#generateXenditRefundPayload(refund);
  }

  async #getXenditToken() {
    const pgData = await this.paymentGatewayService.findOneLikeName({
      pgName: 'xendit',
    });
    const credentialData = JSON.parse(pgData.credential);
    // console.log(credentialData);
    const credential = credentialData[await this.configService.get('nodeEnv')];
    return credential;
  }

  async #generateXenditRefundPayload(refund) {
    const refundData = refund.refundData;
    const refundBankData = refund.refundBankData;
    const refundAmountData = refund.refundAmountData;
    const sequence = refund.retryAttempt ? refund.retryAttempt.length : 0;
    let refundId;
    if (sequence > 0) {
      refundId = refund.refundId + '-' + sequence;
    } else {
      refundId = refund.refundId;
    }

    const payloadRefund = {
      external_id: refundId,
      amount: refundAmountData.amount,
      bank_code: refundBankData.bankCode,
      account_holder_name: refundBankData.bankName,
      account_number: refundBankData.bankNumber,
      description: refundData.reqData.invoice.reason,

      idempotencyKey: null,
    };

    const countCall = refund.pgCallback ? refund.pgCallback.length : 0;
    const retryCode = ('00' + (countCall * 1 + 1)).slice(-3);
    const idempotencyKey = refund.refundId + '-' + retryCode;

    payloadRefund.idempotencyKey = idempotencyKey;

    const requestXenditData = payloadRefund;
    requestXenditData.idempotencyKey = idempotencyKey;
    const requestData = refund.requestData ? refund.requestData : [];
    requestData.push(requestXenditData);
    return {
      requestData: requestData,
      payloadRefund: payloadRefund,
    };
  }
}
