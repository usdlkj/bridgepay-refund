import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { RefundDetail } from './entities/refund-detail.entity';
import { RefundDetailTicket } from './entities/refund-detail-ticket.entity';
import { RefundWebhookCall } from './entities/refund-webhook-call.entity';
import { XenditWebhookDto } from './dto/xendit-webhook.dto';
import { ConfigurationService } from 'src/configuration/configuration.service';
import { YggdrasilService } from 'src/yggdrasil/yggdrasil.service';
import { maskAccountNumber } from 'src/utils/mask.util';
import * as moment from 'moment-timezone';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import { Logger } from 'nestjs-pino';

@Injectable()
export class WebhookService {
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

    @InjectRepository(RefundWebhookCall)
    private repositoryRefundWebhookCall: Repository<RefundWebhookCall>,

    private readonly configService: ConfigService,

    private configurationService: ConfigurationService,

    private yggdrasilService: YggdrasilService,
    private readonly logger: Logger,
  ) {
    this.env = getEnv(this.configService);
  }

  private sanitizeCallbackData(data: any) {
    try {
      const cloned = JSON.parse(JSON.stringify(data));
      if (cloned?.channel_properties?.account_number) {
        cloned.channel_properties.account_number = maskAccountNumber(
          cloned.channel_properties.account_number,
        );
      }
      if (cloned?.channel_properties?.accountNo) {
        cloned.channel_properties.accountNo = maskAccountNumber(
          cloned.channel_properties.accountNo,
        );
      }
      return cloned;
    } catch {
      return data;
    }
  }

  private sanitizeWebhookPayload(payload: any) {
    try {
      const cloned = JSON.parse(JSON.stringify(payload));
      if (cloned?.data?.channel_properties?.account_number) {
        cloned.data.channel_properties.account_number = maskAccountNumber(
          cloned.data.channel_properties.account_number,
        );
      }
      return cloned;
    } catch {
      return payload;
    }
  }

  async xendit(
    payload: XenditWebhookDto,
    callbackToken: string,
    rawPayload: any = null,
  ) {
    try {
      const credential = await this.helper.getXenditCredential(
        this.coreService,
        this.logger,
        this.env,
      );
      if (callbackToken != credential.callbackToken) {
        this.logger.error('Webhook token mismatch');
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Callback Token mismatch',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const payloadToStore = rawPayload || payload;
      const payout = payload.data;
      if (!payout) {
        this.logger.error('Invalid payload: missing data');
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Invalid payload: missing data',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const payoutStatus = payout.status?.toLowerCase();
      const referenceId = payout.reference_id;
      if (!referenceId) {
        this.logger.error('Invalid payload: missing reference_id');
        throw new HttpException(
          {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Invalid payload: missing reference_id (order number)',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      const disbursementId = payout.id;
      const refundId = referenceId;
      const _where = {
        where: {
          refundId: refundId,
          refundStatus: In(['pendingDisbursement', 'retry']),
        },
      };

      try {
        const check = await this.repositoryRefund.findOne(_where);
        const sanitizedWebhookPayload =
          this.sanitizeWebhookPayload(payloadToStore);
        const webhookLog = this.repositoryRefundWebhookCall.create({
          refund: check || null,
          refundRef: refundId,
          source: 'xendit',
          payload: sanitizedWebhookPayload,
        });
        await this.repositoryRefundWebhookCall.save(webhookLog);
        if (check) {
          //get balance data
          const balancePayload = {
            provider: 'xendit',
            func: 'get-balance',
            token: credential.secretKey,
          };
          const balance = await this.yggdrasilService.refund(balancePayload);
          //end get balance data

          const isSuccess = payoutStatus === 'succeeded';
          const isInProgress =
            payoutStatus === 'accepted' ||
            payoutStatus === 'requested' ||
            payoutStatus === 'pending' ||
            payoutStatus === 'queued';
          const isFailure =
            payoutStatus === 'failed' ||
            payoutStatus === 'cancelled' ||
            payoutStatus === 'reversed';

          if (isSuccess) {
            const refundDate = moment().format('YYYY-MM-DD HH:mm:ss');
            await this.repositoryRefund.update(check.id, {
              refundStatus: RefundStatus.SUCCESS,
              disbursementId: disbursementId ?? check.disbursementId,
              disbursementResponse: this.sanitizeCallbackData(payout),
              refundDate: refundDate,
              updatedAt: moment().toISOString(),
            });

            //generate payload
            const payload = {};
            payload['balance'] = balance.data.balance;
            payload['bankCode'] =
              '' + check.refundData.reqData.account.bankId + '';
            payload['bankNo'] = maskAccountNumber(
              '' + check.refundData.reqData.account.accountNo + '',
            );
            payload['curType'] = '360';
            payload['fee'] = check.refundAmountData.fee;
            payload['mwNo'] = '' + check.id + '';
            payload['orderId'] = '' + check.refundId + '';
            payload['pgCode'] = 'xendit';
            ((payload['rate'] = '0%+' + check.refundAmountData.fee + ''),
              (payload['refundAmount'] = check.refundAmountData.amount));
            payload['status'] =
              '' + (await this.helper.statusWording('success')) + '';
            payload['tradeTime'] =
              '' +
              moment(payout.updated)
                .tz('Asia/Jakarta')
                .format('YYYYMMDDHHmmss') +
              '';
            const sign = await this.helper.sign(JSON.stringify({ payload }));
            const tickectingPayload = {
              retData: payload,
              signMsg: sign,
            };
            //end generate payload
            await this.#notifTicketing(
              check.refundData,
              tickectingPayload,
              check.id,
              check.notifLog,
              'success',
            );
          } else if (isInProgress) {
            await this.repositoryRefund.update(check.id, {
              updatedAt: moment().toISOString(),
            });
          } else if (isFailure) {
            if (
              payout.failure_code?.toUpperCase() == 'INVALID_DESTINATION' ||
              payout.failure_code?.toUpperCase() == 'REJECTED_BY_BANK' ||
              payout.failure_code?.toUpperCase() == 'TRANSFER_ERROR' ||
              payout.failure_code?.toUpperCase() == 'EMPTY_ACCOUNT_NAME' ||
              payout.failure_code?.toUpperCase() == 'REJECTED_BY_CHANNEL'
            ) {
              const payload = {};
              const payloadSign = {};

              payload['balance'] = balance.data.balance;
              payload['bankCode'] =
                '' + check.refundData.reqData.account.bankId + '';
              payload['bankNo'] = maskAccountNumber(
                '' + check.refundData.reqData.account.accountNo + '',
              );
              payload['curType'] = '360';
              payload['fee'] = '';
              payload['mwNo'] = '' + check.id + '';
              payload['orderId'] = '' + check.refundId + '';
              payload['pgCode'] = '';
              ((payload['rate'] = ''),
                (payload['refundAmount'] = check.refundAmountData.amount));
              payload['status'] =
                '' + (await this.helper.statusWording('fail')) + '';
              payload['tradeTime'] = '';

              payloadSign['balance'] = balance.data.balance;
              payloadSign['bankCode'] =
                '' + check.refundData.reqData.account.bankId + '';
              payloadSign['bankNo'] = maskAccountNumber(
                '' + check.refundData.reqData.account.accountNo + '',
              );
              payloadSign['curType'] = '360';
              payloadSign['mwNo'] = '' + check.id + '';
              payloadSign['orderId'] = '' + check.refundId + '';
              payloadSign['refundAmount'] = check.refundAmountData.amount;
              payloadSign['status'] =
                '' + (await this.helper.statusWording('fail')) + '';
              const sign = await this.helper.sign(JSON.stringify(payloadSign));
              const tickectingPayload = {
                retData: payload,
                signMsg: sign,
              };
              await this.#notifTicketing(
                check.refundData,
                tickectingPayload,
                check.id,
                check.notifLog,
                'fail',
              );
            } else {
              const tryCount =
                await this.configurationService.findByConfigName(
                  'REFUND_TRY_COUNT',
                );
              let config = 1;
              if (tryCount) {
                config = parseInt(tryCount.configValue);
              }
              const failAttempt = config || 1;
              const retryAttempt = check.retryAttempt
                ? check.retryAttempt.length
                : 0;
              if (failAttempt == retryAttempt) {
                const payload = {};
                const payloadSign = {};

                payload['balance'] = balance.data.balance;
                payload['bankCode'] =
                  '' + check.refundData.reqData.account.bankId + '';
                payload['bankNo'] = maskAccountNumber(
                  '' + check.refundData.reqData.account.accountNo + '',
                );
                payload['curType'] = '360';
                payload['fee'] = '';
                payload['mwNo'] = '' + check.id + '';
                payload['orderId'] = '' + check.refundId + '';
                payload['pgCode'] = '';
                ((payload['rate'] = ''),
                  (payload['refundAmount'] = check.refundAmountData.amount));
                payload['status'] =
                  '' + (await this.helper.statusWording('fail')) + '';
                payload['tradeTime'] = '';

                payloadSign['balance'] = balance.data.balance;
                payloadSign['bankCode'] =
                  '' + check.refundData.reqData.account.bankId + '';
                payloadSign['bankNo'] = maskAccountNumber(
                  '' + check.refundData.reqData.account.accountNo + '',
                );
                payloadSign['curType'] = '360';
                payloadSign['mwNo'] = '' + check.id + '';
                payloadSign['orderId'] = '' + check.refundId + '';
                payloadSign['refundAmount'] = check.refundAmountData.amount;
                payloadSign['status'] =
                  '' + (await this.helper.statusWording('fail')) + '';
                const sign = await this.helper.sign(
                  JSON.stringify(payloadSign),
                );
                const tickectingPayload = {
                  retData: payload,
                  signMsg: sign,
                };
                await this.#notifTicketing(
                  check.refundData,
                  tickectingPayload,
                  check.id,
                  check.notifLog,
                  'fail',
                );
              } else {
                const tyrPeriod =
                  await this.configurationService.findByConfigName(
                    '⁠REFUND_TRY_TIME_PERIOD',
                  );
                let configTryPeriod = 10;
                if (tyrPeriod) {
                  configTryPeriod = parseInt(tyrPeriod.configValue);
                }

                if (configTryPeriod < 10) {
                  configTryPeriod = 60;
                }
                const retryDate = moment()
                  .add(configTryPeriod, 'm')
                  .toISOString();
                await this.repositoryRefund.update(check.id, {
                  refundStatus: RefundStatus.FAIL,
                  retryDate: retryDate,
                });
              }
            }
          }
        }
      } catch (err) {
        this.logger.error('Webhook processing error', {
          err: err instanceof Error ? err.message : String(err),
          payoutId: disbursementId,
          referenceId,
        });
      }
      return { message: 'OK' };
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'failed handle webhook',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async #notifTicketing(
    refundData,
    payload,
    refundId,
    notifLogData,
    type: 'success' | 'fail',
  ) {
    //notif ticketing
    const notifDate = moment().format('YYYY-MM-DD HH:mm:ss');
    let notif = null;
    try {
      notif = await axios({
        url: refundData.reqData.invoice.notifyUrl,
        method: 'post',
        data: payload,
      });
    } catch (err) {
      this.logger.error('Failed to notify ticketing', {
        err: err instanceof Error ? err.message : String(err),
        url: refundData.reqData.invoice.notifyUrl,
      });
      if (type === 'fail') {
        await this.repositoryRefund.update(refundId, {
          refundStatus: RefundStatus.FAIL,
          updatedAt: moment().toISOString(),
        });
      }
      return;
    }
    const responseAt = moment().format('YYYY-MM-DD HH:mm:ss');
    const notifLog = notifLogData ? notifLogData : [];
    const notifLogPayload = {
      payload: payload,
      initAt: notifDate,
      responseData: notif.data,
      responseAt: responseAt,
    };
    notifLog.push(notifLogPayload);
    const payloadNotif = {
      notifLog: notifLog,
      updatedAt: moment().toISOString(),
    };
    if (type == 'success') {
      console.log(notif);
      // console.log(notif.status);
      if (
        (notif.status == 200 || notif.status == 201) &&
        notif.data.retCode == 0
      ) {
        payloadNotif['refundStatus'] = RefundStatus.DONE;
      }
      console.log(payloadNotif);
      await this.repositoryRefund.update(refundId, payloadNotif);
    } else {
      payloadNotif['refundStatus'] = RefundStatus.FAIL;
      await this.repositoryRefund.update(refundId, payloadNotif);
    }
    //end notif ticketing
  }
}
