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
import { BankData } from 'src/iluma/entities/bank-data.entity';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, EntityManager } from 'typeorm';
import { Logger } from 'nestjs-pino';
import { CreateRefundDto } from './dto/create-refund.dto';
import { StatusRefundDto } from './dto/status-refund.dto';
import { EncryptorClient } from 'src/utils/encryptor.client';
import { maskAccountNumber } from 'src/utils/mask.util';
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

    @InjectRepository(BankData)
    private repositoryBankData: Repository<BankData>,

    private readonly configService: ConfigService,
    private readonly logger: Logger,
    private readonly encryptorClient: EncryptorClient,
  ) {
    this.env = getEnv(this.configService);
  }

  async create(payload: CreateRefundDto) {
    try {
      const ticketingCall = this.getTicketingCall(payload);
      const credential = await this.helper.getXenditCredential(
        this.coreService,
        this.logger,
        this.env,
      );

      const refund = await this.repositoryRefund.manager.transaction(
        async (manager) => {
          await this.ensureNoDuplicate(
            payload.reqData.invoice.orderId,
            manager,
          );
          const refundBankData = await this.getBankData(payload, manager);
          const refundAmountData = await this.helper.totalAmountDisbursement(
            payload.reqData.invoice.refundAmount,
          );
          const bankDataId = await this.getOrCreateBankData(
            refundBankData.bankCode,
            payload.reqData.account.accountNo,
            manager,
          );

          const createdRefund = await this.createRefundRecord(
            payload,
            refundBankData,
            refundAmountData,
            ticketingCall,
            bankDataId,
            manager,
          );

          if (ticketingCall === 1) {
            await this.processTicketingData(payload, createdRefund, manager);
          }

          return createdRefund;
        },
      );

      const invoice = await this.buildInvoicePayload(
        payload.reqData.invoice.orderId,
        await this.helper.statusWording('rbdApproval'),
      );

      return await this.executeDisbursementFlow(refund, credential, invoice);
    } catch (e) {
      return await this.handleCreateError(payload, e);
    }
  }

  private getTicketingCall(payload: CreateRefundDto) {
    return payload.ticketCall && payload.ticketCall == 0 ? 0 : 1;
  }

  private async ensureNoDuplicate(refundId: string, manager: EntityManager) {
    const check = await manager.getRepository(Refund).findOne({
      where: {
        refundId,
      },
    });
    if (check) {
      throw new Error('Duplicate Request');
    }
  }

  private async getBankData(payload: CreateRefundDto, manager: EntityManager) {
    const checkBank = await manager.getRepository(RefundBank).findOne({
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
    return {
      bankName: payload.reqData.account.name,
      bankNumber: payload.reqData.account.accountNo,
      bankCode: payload.reqData.account.bankId,
    };
  }

  private async createRefundRecord(
    payload: CreateRefundDto,
    refundBankData,
    refundAmountData,
    ticketingCall: number,
    bankDataId: string,
    manager: EntityManager,
  ) {
    const payloadSave = {
      refundId: payload.reqData.invoice.orderId,
      refundData: this.sanitizeRefundData(payload),
      refundStatus:
        ticketingCall == 1
          ? RefundStatus.PENDINGCHECKING
          : RefundStatus.RBDAPPROVAL,
      refundAmount: payload.reqData.invoice.refundAmount,
      refundReason: payload.reqData.invoice.reason,
      refundBankData: refundBankData,
      refundAmountData: refundAmountData,
      bankDataId,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    };
    try {
      const payloadSaveCreate = await manager
        .getRepository(Refund)
        .create(payloadSave);
      const create = await manager
        .getRepository(Refund)
        .save(payloadSaveCreate);
      if (!create) {
        throw new Error('Fail to save data');
      }
      return create;
    } catch (error) {
      // Postgres duplicate error code
      const isDuplicateError = error?.code === '23505';
      if (isDuplicateError) {
        throw new Error('Duplicate Request');
      }
      throw error;
    }
  }

  private async processTicketingData(
    payload: CreateRefundDto,
    refund: Refund,
    manager: EntityManager,
  ) {
    const dataDetail = await this.mockedTicketingCheck(
      payload.reqData.invoice.orderId,
    );
    const rowData = dataDetail.data.retData;
    const detailTicketing = {
      email: rowData.email,
      phoneNumber: rowData.phoneNumber,
      reason: rowData.reason,
      refundAmount: rowData.refundAmount,
      refundId: rowData.refundId,
      ticketOffice: rowData.ticketOffice,
      refundMwId: refund.id,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    };
    const detailTicketingSave = await manager
      .getRepository(RefundDetail)
      .create(detailTicketing);
    const saveDetail = await manager
      .getRepository(RefundDetail)
      .save(detailTicketingSave);

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
        refundDetail: saveDetail,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      const ticketSave = await manager
        .getRepository(RefundDetailTicket)
        .create(ticket);
      await manager.getRepository(RefundDetailTicket).save(ticketSave);
    }

    await manager.getRepository(Refund).update(refund.id, {
      refundDetail: saveDetail,
    });
  }

  private async buildInvoicePayload(orderId: string, status: string) {
    const invoice = {};
    invoice['orderId'] = orderId;
    invoice['status'] = status;
    return invoice;
  }

  private async executeDisbursementFlow(refund: Refund, credential, invoice) {
    const existingRefund = await this.repositoryRefund.findOne({
      where: {
        refundId: refund.refundId,
      },
    });
    const currentRefund = existingRefund || refund;

    const { requestData, payloadRefund } =
      await this.generateXenditRefundPayload(currentRefund);

    const payloadDisbursement = {
      provider: 'xendit',
      func: 'disbursement',
      data: payloadRefund,
      token: credential.secretKey,
      idempotencyKey: currentRefund.refundId,
    };

    const xendit = await this.disbursement(payloadDisbursement);
    if (xendit.status == 200) {
      await this.repositoryRefund.manager.transaction(async (manager) => {
        await manager.getRepository(Refund).update(currentRefund.id, {
          requestData: requestData,
          refundStatus: RefundStatus.PENDINGDISBURSEMENT,
          disbursementId: xendit?.data?.id,
          disbursementResponse: this.sanitizeDisbursementResponse(xendit.data),
        });
      });
      invoice['status'] = await this.helper.statusWording(
        'pendingDisbursement',
      );
    } else {
      throw new Error('Failed Xendit disbursement');
    }
    const sign = await this.helper.sign(JSON.stringify({ invoice: invoice }));
    return {
      retCode: 0,
      retMsg: 'Success',
      retData: {
        invoice,
      },
      signMsg: sign,
    };
  }

  private async handleCreateError(payload: CreateRefundDto, e) {
    const logPayload = {
      type: 'api',
      location: '/api/v2/transfer',
      detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      msg: e.message,
      notes: payload?.reqData?.invoice?.orderId ?? null,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    };
    const logPayloadSave = await this.repositoryRefundLog.create(logPayload);
    await this.repositoryRefundLog.save(logPayloadSave);
    const isDuplicate =
      e?.code === '23505' ||
      (e instanceof Error && e.message === 'Duplicate Request');
    if (!isDuplicate) {
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
    }
    const result = {
      retCode: -1,
      retMsg: e.message,
    };
    const statusCode = isDuplicate
      ? HttpStatus.CONFLICT
      : HttpStatus.INTERNAL_SERVER_ERROR;
    throw new HttpException(result, statusCode);
  }

  private async handleDisbursementError(refundId: string, e) {
    const logPayload = {
      type: 'disbursement',
      location: 'disbursement-listener',
      detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      msg: e.message,
      notes: refundId ?? null,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    };
    const logPayloadSave = await this.repositoryRefundLog.create(logPayload);
    await this.repositoryRefundLog.save(logPayloadSave);

    const existingRefund = await this.repositoryRefund.findOne({
      where: {
        refundId,
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

  async status(payload: StatusRefundDto) {
    try {
      const credential = await this.helper.getXenditCredential(
        this.coreService,
        this.logger,
        this.env,
      );

      const check = await this.repositoryRefund.findOne({
        where: {
          refundId: payload.reqData.invoice.orderId,
        },
      });

      if (!check) {
        throw new Error('Refund not found');
      }
      const jsonData = check.refundData;
      const payoutData = check.disbursementId
        ? await this.fetchPayoutStatus(
            check.disbursementId,
            credential.secretKey,
          )
        : null;
      const invoice = {};

      //create payload
      invoice['balance'] = payoutData?.amount ?? null;
      invoice['bankCode'] = jsonData.reqData.account.bankId;
      if (payoutData?.channel_properties?.account_number) {
        invoice['bankNo'] = maskAccountNumber(
          payoutData.channel_properties.account_number,
        );
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
      if (payoutData?.updated) {
        invoice['tradeTime'] = moment(payoutData.updated)
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

  async generateXenditRefundPayload(refund: Refund) {
    const refundData = refund.refundData;
    const refundBankData = refund.refundBankData;
    const refundAmountData = refund.refundAmountData;
    const sequence = refund.retryAttempt ? refund.retryAttempt.length : 0;
    const refundId =
      sequence > 0 ? refund.refundId + '-' + sequence : refund.refundId;

    /**
     * old payload structure
     */
    // const payloadRefund = {
    //   external_id: refundId,
    //   amount: refundAmountData.amount,
    //   bank_code: refundBankData.bankCode,
    //   account_holder_name: refundBankData.bankName,
    //   account_number: refundBankData.bankNumber,
    //   description: refundData.reqData.invoice.reason,

    //   idempotencyKey: null,
    // };

    const payloadRefund = {
      reference_id: refundId,
      channel_code: refundBankData.bankCode,
      channel_properties: {
        account_number: refundBankData.bankNumber,
        account_holder_name: refundBankData.bankName,
      },
      amount: refundAmountData.amount,
      description: refundData.reqData.invoice.reason,
      currency: 'IDR',
      idempotencyKey: null,
    };

    const idempotencyKey = refund.refundId;

    payloadRefund.idempotencyKey = idempotencyKey;

    const maskedAccountNumber = maskAccountNumber(refundBankData.bankNumber);
    const requestXenditData = {
      ...payloadRefund,
      channel_properties: {
        ...payloadRefund.channel_properties,
        account_number: maskedAccountNumber,
      },
      idempotencyKey: idempotencyKey,
    };
    const requestData = refund.requestData ? refund.requestData : [];
    requestData.push(requestXenditData);
    return {
      requestData: requestData,
      payloadRefund: payloadRefund,
    };
  }

  private sanitizeDisbursementResponse(response: any) {
    try {
      const cloned = JSON.parse(JSON.stringify(response));
      const accountNumber =
        cloned?.channel_properties?.account_number ||
        cloned?.channel_properties?.accountNo;
      if (accountNumber) {
        const masked = maskAccountNumber(accountNumber);
        if (cloned.channel_properties) {
          cloned.channel_properties.account_number = masked;
          if ('accountNo' in cloned.channel_properties) {
            cloned.channel_properties.accountNo = masked;
          }
        }
      }
      return cloned;
    } catch {
      return response;
    }
  }

  private sanitizeRefundData(payload: CreateRefundDto) {
    try {
      const cloned = JSON.parse(JSON.stringify(payload));
      const account = cloned?.reqData?.account;
      if (account?.accountNo) {
        account.accountNo = maskAccountNumber(account.accountNo);
      }
      return cloned;
    } catch {
      return payload;
    }
  }

  private async getOrCreateBankData(
    bankCode: string,
    accountNumber: string,
    manager: EntityManager,
  ): Promise<string> {
    const accountNumberHash = await this.encryptorClient.send('blind-index', {
      value: accountNumber,
      context: 'refund.bankData.accountNumber',
    });
    const existing = await manager.getRepository(BankData).findOne({
      where: {
        bankCode,
        accountNumberHash,
      },
    });
    if (existing) {
      return existing.id;
    }
    const accountNumberEnc = await this.encryptorClient.send('encrypt', {
      value: Buffer.from(accountNumber).toString('base64'),
      aad: Buffer.from('refund.bankData.accountNumber').toString('base64'),
      context: 'refund.bankData.accountNumber',
    });

    const payload = manager.getRepository(BankData).create({
      bankCode,
      accountNumberEnc,
      accountNumberHash,
      accountStatus: 'pending',
      accountResult: 'pending',
      lastCheckAt: moment().toISOString(),
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });
    const created = await manager.getRepository(BankData).save(payload);
    return created.id;
  }

  private async disbursement(payload) {
    try {
      const auth = payload.token + ':';
      const key = Buffer.from(auth).toString('base64');
      const disbursement = await axios.post(
        'https://api.xendit.co/v2/payouts',
        payload.data,
        {
          headers: {
            Authorization: 'Basic ' + key,
            'Content-Type': 'application/json',
            'Idempotency-key': payload.idempotencyKey,
          },
        },
      );
      if (disbursement.status == 200) {
        return {
          status: 200,
          data: disbursement.data,
        };
      } else {
        return {
          status: disbursement.status,
          data: JSON.stringify(disbursement),
        };
      }
    } catch (e) {
      return {
        status: 500,
        data: JSON.stringify(e.response?.data || e.message),
      };
    }
  }

  private async fetchPayoutStatus(payoutId: string, token: string) {
    try {
      const auth = token + ':';
      const key = Buffer.from(auth).toString('base64');
      const payout = await axios.get(
        `https://api.xendit.co/v2/payouts/${payoutId}`,
        {
          headers: {
            Authorization: 'Basic ' + key,
            'Content-Type': 'application/json',
          },
        },
      );
      return payout.data;
    } catch (e) {
      throw new Error(
        `Failed to fetch payout status: ${
          e.response?.data?.message || e.message
        }`,
      );
    }
  }

  /**
   * Mocked ticketing check for refund.
   * The following is the original logic (now commented out):
   *
   * //const reqData = {
   * //  languageCode: 'id_ID',
   * //  refundId: refundId,
   * //};
   * //const signDetail = await this.helper.sign(JSON.stringify(reqData));
   * //console.log(reqData);
   * //console.log(signDetail);
   * //const payloadDetail = {
   * //  reqData,
   * //  signMsg: signDetail,
   * //};
   * //let dataDetail;
   * //dataDetail = await axios({
   * //  url:
   * //    (await this.configService.get('ticketingApiBaseUrl')) +
   * //    '/payplat/bank/queryRefundTicketInfo',
   * //  method: 'post',
   * //  data: payloadDetail,
   * //});
   * //const ticketingCallPayload = {
   * //  refundNumber: refundId,
   * //  payload: payload,
   * //  response: dataDetail.data,
   * //  createdAt: moment().toISOString(),
   * //  updatedAt: moment().toISOString(),
   * //};
   * //const ticketingCallPayloadSave =
   * //  await this.repositoryTicketingCallLog.create(ticketingCallPayload);
   * //await this.repositoryTicketingCallLog.save(ticketingCallPayloadSave);
   * //if (dataDetail.data.retCode != '0') {
   * //  throw new Error(
   * //    'Fail get Data from ticketing with message : ' +
   * //      dataDetail.data.retMsg,
   * //  );
   * //}
   */
  private async mockedTicketingCheck(refundId: string) {
    return {
      data: {
        retCode: '0',
        retData: {
          tickets: [],
          email: '',
          phoneNumber: '',
          reason: '',
          refundAmount: 0,
          refundId,
          ticketOffice: '',
        },
      },
    };
  }
}
