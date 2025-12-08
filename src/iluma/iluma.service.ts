/**
 * IlumaService – Direct integration with Iluma APIs.
 * Handles:
 *  - Account validation requests
 *  - Normalized responses
 *  - Polling and worker fallbacks
 *  - Webhook updates
 *  - BankData lifecycle management
 */
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IlumaCallLog } from './entities/iluma-call-log.entity';
import { IlumaCallback } from './entities/iluma-callback.entity';
import { ClientProxy } from '@nestjs/microservices';
import { getEnv } from '../utils/env.utils';
import { Helper } from 'src/utils/helper';
import { ConfigService } from '@nestjs/config';
import { RefundBank } from 'src/refund/entities/refund-bank.entity';
import * as moment from 'moment-timezone';
import { BankData } from './entities/bank-data.entity';
import { CheckAccountDto } from './dto/check-account.dto';

import axios from 'axios';
import { Logger } from 'nestjs-pino';

/**
 * Iluma API endpoints
 */
const ILUMA_VALIDATE_PATH = '/bank_account_validation_details';
const ILUMA_RESULT_PATH = (id: string) =>
  `/bank_account_validation_details/${id}`;

@Injectable()
export class IlumaService {
  private env: string;
  private ilumaBaseUrl: string;

  private generateBasicKey(rawToken: string): string {
    return Buffer.from(rawToken + ':').toString('base64');
  }

  private async ilumaPost<T = any>(
    url: string,
    body: any,
  ): Promise<{ status: number; data: T }> {
    const token = this.configService.get<string>('iluma.token');

    try {
      const resp = await axios.post(url, body, {
        headers: {
          Authorization: `Basic ${this.generateBasicKey(token)}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // mirrors 3rd-party client behavior
      });

      return { status: resp.status, data: resp.data };
    } catch (error: any) {
      const normalized = this.normalizeIlumaError(error);
      return {
        status: normalized.httpStatus,
        data: normalized, // caller will interpret normalized error
        error: normalized,
      } as any;
    }
  }

  /**
   * Internal Iluma GET wrapper
   */
  private async ilumaGet<T = any>(
    url: string,
  ): Promise<{ status: number; data: T }> {
    const token = this.configService.get<string>('iluma.token');

    try {
      const resp = await axios.get(url, {
        headers: {
          Authorization: `Basic ${this.generateBasicKey(token)}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return { status: resp.status, data: resp.data };
    } catch (error: any) {
      const normalized = this.normalizeIlumaError(error);
      return {
        status: normalized.httpStatus,
        data: normalized,
        error: normalized,
      } as any;
    }
  }

  /**
   * Unified logger for Iluma call logs to reduce duplication.
   */
  private async writeIlumaLog(
    url: string,
    func: string,
    payload: any,
    response: any,
  ) {
    const logEntry = this.repositoryCallLog.create({
      url,
      func,
      payload,
      method: 'post',
      response,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });
    await this.repositoryCallLog.save(logEntry);
  }

  constructor(
    private readonly helper: Helper,
    @Inject('RefundToCoreClient') private readonly coreService: ClientProxy,
    @Inject('RefundToEncryptorClient')
    private readonly encryptorService: ClientProxy,

    @InjectRepository(RefundBank)
    private repositoryRefundBank: Repository<RefundBank>,

    @InjectRepository(IlumaCallLog)
    private repositoryCallLog: Repository<IlumaCallLog>,

    @InjectRepository(IlumaCallback)
    private repositoryCallback: Repository<IlumaCallback>,

    @InjectRepository(BankData)
    private repositoryBankData: Repository<BankData>,

    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.env = getEnv(this.configService);
    const base = this.configService.get<string>('iluma.baseUrl');
    this.ilumaBaseUrl = base
      ? `${base}/v1.2/identity`
      : 'https://api.iluma.ai/v1.2/identity';
  }

  private async resolveBank(ilumaCode: string): Promise<RefundBank | null> {
    return this.repositoryRefundBank.findOne({
      where: { ilumaCode },
    });
  }

  private async resolveBankData(
    bank: RefundBank,
    incomingAccount: string,
    incomingHash: string,
    datePast: Date,
  ): Promise<BankData> {
    // Look up existing BankData
    const existing = await this.repositoryBankData.findOne({
      where: {
        bankCode: bank.xenditCode,
        accountNumberHash: incomingHash,
      },
    });

    if (existing) {
      // If pending, return as-is
      if (existing.accountStatus === 'pending') {
        return existing;
      }

      const isFresh =
        existing.lastCheckAt && moment(existing.lastCheckAt).isAfter(datePast);

      if (isFresh && existing.accountStatus === 'completed') {
        return existing;
      }

      // Stale = expired
      await this.repositoryBankData.update(existing.id, {
        accountStatus: 'expired',
        accountResult: 'failed',
        updatedAt: moment().toISOString(),
        lastCheckAt: moment().toISOString(),
      });

      this.logInternal('BankData state transition', {
        id: existing.id,
        from: existing.accountStatus,
        to: 'expired',
        source: 'resolveBankData:stale',
      });

      return null;
    }

    // No existing = create new BankData
    const accountEnc = await this.encryptorService
      .send('encrypt', {
        value: Buffer.from(incomingAccount).toString('base64'),
        aad: Buffer.from('refund.bankData.accountNumber').toString('base64'),
        context: 'refund.bankData.accountNumber',
      })
      .toPromise();

    const created = this.repositoryBankData.create({
      bankCode: bank.xenditCode,
      accountNumberEnc: accountEnc,
      accountNumberHash: incomingHash,
      accountStatus: 'pending',
      accountResult: 'pending',
      lastCheckAt: moment().toISOString(),
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
    });

    return this.repositoryBankData.save(created);
  }

  /**
   * Unified internal logger for IlumaService (Phase E.1)
   * Ensures consistent, centralized logging with redaction.
   */
  private logInternal(message: string, meta: any = {}) {
    try {
      const safeMeta = { ...meta };

      // Redact sensitive values
      if (safeMeta.accountNumber) {
        safeMeta.accountNumber = this.helper.maskString(safeMeta.accountNumber);
      }
      if (safeMeta.payload?.bank_account_number) {
        safeMeta.payload.bank_account_number = this.helper.maskString(
          safeMeta.payload.bank_account_number,
        );
      }

      this.logger?.log?.(`[IlumaService] ${message}`, JSON.stringify(safeMeta));
    } catch {
      // Never throw from logging
    }
  }

  /**
   * Phase E.2.1 – Normalize Iluma error into a consistent internal shape.
   */
  private normalizeIlumaError(raw: any) {
    return {
      code: this.extractIlumaErrorCode(raw),
      message: this.extractIlumaErrorMessage(raw),
      detail: this.extractIlumaErrorDetail(raw),
      httpStatus: raw?.response?.status || 500,
    };
  }

  /**
   * Extract simplified Iluma error code.
   */
  private extractIlumaErrorCode(raw: any): string {
    if (!raw) return 'ILUMA_UNKNOWN';

    const status = raw?.response?.status;
    if (status === 401) return 'ILUMA_AUTH_FAILED';
    if (status === 408) return 'ILUMA_TIMEOUT';
    if (status === 429) return 'ILUMA_RATE_LIMIT';
    if (status === 500) return 'ILUMA_SERVER_ERROR';

    if (raw?.code === 'ECONNABORTED') return 'ILUMA_TIMEOUT';
    if (raw?.code === 'ENOTFOUND') return 'ILUMA_NETWORK_ERROR';

    return 'ILUMA_ERROR';
  }

  /**
   * Extract human-readable error message from various Axios shapes.
   */
  private extractIlumaErrorMessage(raw: any): string {
    if (!raw) return 'Unknown Iluma error';

    return (
      raw?.response?.data?.message ||
      raw?.message ||
      raw?.response?.statusText ||
      'Iluma error'
    );
  }

  /**
   * Extract safe detail (for logs, not returned to client).
   */
  private extractIlumaErrorDetail(raw: any): any {
    if (!raw) return null;

    const detail = {
      responseStatus: raw?.response?.status,
      responseData: raw?.response?.data,
      code: raw?.code,
    };

    return detail;
  }

  /**
   * Normalize Iluma response into a consistent internal shape.
   * This handles ALL Iluma variants:
   *  - synchronous validator response
   *  - polling GET-result
   *  - webhook callback
   *  - worker fallback
   *  - wrapped forms: { status, data }, { data }, raw data
   */
  private normalizeIlumaResponse(raw: any) {
    if (!raw) {
      return {
        id: null,
        status: 'unknown',
        raw,
      };
    }

    // Some calls return { status, data }
    // Some return { data }
    // Some return pure Iluma JSON (webhook)
    const data = raw?.data ?? raw;

    const status =
      data?.status?.toString().toLowerCase() ||
      raw?.status?.toString().toLowerCase() ||
      'unknown';

    const result = data?.result || null;

    return {
      id: data?.id || data?.requestNumber || null,
      status,
      bankCode: data?.bank_code || null,
      bankAccountNumberMasked: null, // never store plaintext
      created: data?.created || null,
      updated: data?.updated || null,
      referenceId: data?.reference_id || null,

      result: result
        ? {
            isFound: result.is_found ?? null,
            isVirtualAccount: result.is_virtual_account ?? null,
            accountHolderName: result.account_holder_name ?? null,
            needReview: result.need_review ?? null,
          }
        : null,

      failureReason: data?.failure_reason || null,

      // Full raw payload for audit/debug
      raw,
    };
  }

  private computeFinalStatus(
    data: ReturnType<IlumaService['normalizeIlumaResponse']>,
  ): 'success' | 'failed' {
    if (!data) return 'failed';

    // Must be completed
    if (data.status !== 'completed') return 'failed';

    const r = data.result;
    if (!r) return 'failed';

    // Success criteria: is_found == true AND is_virtual_account == false
    if (r.isFound === true && r.isVirtualAccount === false) {
      return 'success';
    }

    return 'failed';
  }

  /**
   * F.2.1 – Enforce allowed BankData state transitions.
   *
   * Valid transitions:
   *   pending   → completed, expired
   *   completed → completed (idempotent)
   *   expired   → (none)
   */
  private canTransition(prev: string, next: string): boolean {
    if (!prev || !next) return false;

    const allowed: Record<string, string[]> = {
      pending: ['completed', 'expired'],
      completed: ['completed'], // idempotent only
      expired: [], // terminal state
    };

    return allowed[prev]?.includes(next) ?? false;
  }

  /**
   * Unified updater for BankData status/result/Iluma payloads.
   */
  private async updateBankDataStatus(
    id: string,
    status: 'success' | 'failed',
    ilumaPayload: any,
    source: 'sync' | 'polling' | 'worker' | 'webhook' | 'unknown' = 'unknown',
  ) {
    const existing = await this.repositoryBankData.findOne({ where: { id } });
    if (existing && !this.canTransition(existing.accountStatus, 'completed')) {
      this.logInternal('Illegal BankData state transition blocked', {
        id,
        prev: existing.accountStatus,
        attempted: 'completed',
        source,
      });
      return;
    }

    if (existing) {
      this.logInternal('BankData state transition', {
        id,
        from: existing.accountStatus,
        to: 'completed',
        resultStatus: status,
        source,
      });
    }

    await this.repositoryBankData.update(id, {
      accountResult: status,
      ilumaData: this.normalizeIlumaResponse(ilumaPayload) as any,
      updatedAt: moment().toISOString(),
      accountStatus: 'completed',
      lastCheckAt: moment().toISOString(),
    });
  }

  /**
   * D.4 – Handle initial Iluma POST response (pending / completed / other).
   * Returns the final status OR initiates polling when needed.
   */
  private async handleInitialIlumaStatus(
    bankDataRecord: BankData,
    ilumaData: any,
    incomingAccount: string,
    bankCode: string,
  ): Promise<'success' | 'failed' | 'timeout'> {
    const normalized = this.normalizeIlumaResponse(ilumaData);

    // Missing status = failed
    if (!ilumaData || !ilumaData.status) {
      return 'failed';
    }

    const status = ilumaData.status.toLowerCase();

    // Pending → poll
    if (status === 'pending') {
      const maskedAccountNo = this.helper.maskString(incomingAccount);
      return await this.pollUntilDone(
        ilumaData.id,
        bankDataRecord.id,
        maskedAccountNo,
        bankCode,
      );
    }

    // Completed → compute final status and update DB
    if (status === 'completed') {
      const finalStatus = this.computeFinalStatus(normalized);
      await this.updateBankDataStatus(
        bankDataRecord.id,
        finalStatus,
        normalized,
        'sync',
      );
      return finalStatus;
    }

    // Other statuses = failed
    return this.computeFinalStatus(normalized);
  }

  private async pollUntilDone(
    requestId: string,
    bankDataId: string,
    maskedAccount?: string,
    bankCode?: string,
  ): Promise<'success' | 'failed' | 'timeout'> {
    let finalStatus: 'success' | 'failed' = 'failed';
    const startTime = Date.now();

    const maxWaitMs = this.configService.get<number>(
      'iluma.checkAccountWaitMs',
    );
    let sleepMs = this.configService.get<number>(
      'iluma.checkAccountMinSleepMs',
    );
    const maxSleepMs = this.configService.get<number>(
      'iluma.checkAccountMaxSleepMs',
    );

    let finished = false;

    while (!finished && Date.now() - startTime < maxWaitMs) {
      await this.helper.sleep(sleepMs);

      // Check if webhook has already completed BankData
      const refreshedBankData = await this.repositoryBankData.findOne({
        where: { id: bankDataId },
      });

      if (
        refreshedBankData &&
        refreshedBankData.accountStatus === 'completed'
      ) {
        const bdStatus =
          refreshedBankData.accountResult === 'success' ? 'success' : 'failed';

        await this.updateBankDataStatus(
          refreshedBankData.id,
          bdStatus,
          refreshedBankData.ilumaData || null,
          'polling',
        );

        finalStatus = bdStatus;
        finished = true;
        break;
      }

      // F.2.5 – Stop polling immediately if BankData is no longer pending
      if (refreshedBankData && refreshedBankData.accountStatus !== 'pending') {
        this.logInternal('Polling aborted due to non-pending BankData', {
          bankDataId,
          status: refreshedBankData.accountStatus,
        });

        // Determine result based on existing status
        const bdStatus =
          refreshedBankData.accountResult === 'success' ? 'success' : 'failed';

        finalStatus = bdStatus;
        finished = true;
        break;
      }

      // Hit Iluma directly
      const resultUrl = `${this.ilumaBaseUrl}${ILUMA_RESULT_PATH(requestId)}`;
      const check = await this.ilumaGet(resultUrl);

      // Phase E.2.6 – log normalized Iluma polling errors (if any)
      if ((check as any).error) {
        this.logInternal('Iluma polling error (normalized)', {
          requestId,
          bankDataId,
          error: (check as any).error,
        });
      }

      // Log polling attempt (only masked data)
      const loopLog = {
        url: resultUrl,
        func: 'get-result',
        payload: {
          bank_code: bankCode ?? null,
          bank_account_number: maskedAccount ?? null,
        },
        method: 'post',
        response: check,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      this.logInternal('Polling Iluma result', {
        requestId,
        bankDataId,
      });
      await this.writeIlumaLog(
        loopLog.url,
        loopLog.func,
        loopLog.payload,
        loopLog.response,
      );

      if (check.status === 200) {
        const data = check.data;
        if (!data || !data.status) {
          // Still pending → backoff
          sleepMs = Math.min(sleepMs * 2, maxSleepMs);
          continue;
        }

        if (data.status.toLowerCase() === 'completed') {
          const normalized = this.normalizeIlumaResponse(check);
          finalStatus = this.computeFinalStatus(normalized);

          await this.updateBankDataStatus(
            bankDataId,
            finalStatus,
            normalized,
            'polling',
          );

          finished = true;
          break;
        }
      }

      // Still pending → exponential backoff
      sleepMs = Math.min(sleepMs * 2, maxSleepMs);
    }

    // Timeout: no completion
    if (!finished) {
      const existing = await this.repositoryBankData.findOne({
        where: { id: bankDataId },
      });

      await this.repositoryBankData.update(bankDataId, {
        accountResult: 'failed',
        accountStatus: 'expired',
        updatedAt: moment().toISOString(),
        lastCheckAt: moment().toISOString(),
      });

      this.logInternal('BankData state transition', {
        id: bankDataId,
        from: existing?.accountStatus ?? null,
        to: 'expired',
        source: 'polling:timeout',
      });

      // Fire-and-forget worker fallback to re-check Iluma asynchronously.
      this.coreService.emit('refund.iluma.poll', {
        requestId,
        bankDataId,
      });

      return 'timeout';
    }

    return finalStatus;
  }

  private async callIlumaValidator(
    bankCode: string,
    accountNumber: string,
  ): Promise<{ status: number; data: any }> {
    const validateUrl = `${this.ilumaBaseUrl}${ILUMA_VALIDATE_PATH}`;

    const requestBody = {
      bank_code: bankCode,
      bank_account_number: accountNumber,
    };

    const res = await this.ilumaPost(validateUrl, requestBody);

    // Phase E.2.3 – Handle normalized Iluma errors
    if ((res as any).error) {
      this.logInternal('Iluma validator error', {
        bankCode,
        accountNumber,
        error: (res as any).error,
      });

      // Return normalized error shape upstream
      return {
        status: (res as any).error.httpStatus,
        data: (res as any).error,
      };
    }

    // Only masked account number is ever logged
    const maskedBankData = {
      bank_code: bankCode,
      bank_account_number: this.helper.maskString(accountNumber),
    };

    this.logInternal('Calling Iluma validator', {
      bankCode,
      accountNumber,
    });

    await this.writeIlumaLog(
      validateUrl,
      'bank-validator',
      maskedBankData,
      res.data,
    );

    return res;
  }

  async checkAccount(payload: CheckAccountDto) {
    try {
      const bank = await this.resolveBank(payload.reqData.account.bankId);

      if (!bank) {
        return { retCode: -1, retMsg: 'Bank code not found' };
      }

      const incomingAccount = payload.reqData.account.accountNo;

      const datePastString = moment()
        .subtract(await this.configService.get('bankAccountCheckTtlDays'), 'd')
        .toISOString();
      const datePast = new Date(datePastString);

      const incomingHash = await this.encryptorService
        .send('blind-index', {
          value: incomingAccount,
          context: 'refund.bankData.accountNumber',
        })
        .toPromise();

      const bankDataRecord = await this.resolveBankData(
        bank,
        incomingAccount,
        incomingHash,
        datePast,
      );

      const checkIluma = await this.callIlumaValidator(
        bank.xenditCode,
        incomingAccount,
      );

      // Phase E.2.4 – Interpret normalized Iluma errors
      if (checkIluma.status !== 200) {
        const err = checkIluma.data;

        this.logInternal('Iluma validation failed (normalized)', {
          bankCode: bank.xenditCode,
          accountNumber: incomingAccount,
          error: err,
        });

        return {
          retCode: -1,
          retMsg: err?.message || 'Iluma validation failed',
          errorCode: err?.code || 'ILUMA_ERROR',
        };
      }

      const ilumaData = checkIluma.data;
      if (!ilumaData || !ilumaData.status) {
        return { retCode: -1, retMsg: 'Invalid response from Iluma' };
      }
      // Store requestId for correlation
      if (bankDataRecord && ilumaData.id) {
        await this.repositoryBankData.update(bankDataRecord.id, {
          requestId: ilumaData.id,
          updatedAt: moment().toISOString(),
        });
      }

      let finalStatusValue = await this.handleInitialIlumaStatus(
        bankDataRecord,
        ilumaData,
        incomingAccount,
        bank.xenditCode,
      );

      if (finalStatusValue === 'timeout') {
        finalStatusValue = 'failed';
      }
      return this.buildCheckAccountReturn(finalStatusValue);
    } catch (e) {
      this.handleCheckAccountError(e);
    }
  }

  private async buildCheckAccountReturn(status: 'success' | 'failed') {
    const sign = await this.helper.sign(JSON.stringify({ status }));
    return {
      retCode: 0,
      message: 'Success',
      retData: { status },
      signMsg: sign,
    };
  }

  /**
   * Worker fallback: called asynchronously via MessagePattern to re-check Iluma
   * result after the synchronous path has already returned to the caller.
   *
   * Expected payload: { requestId: string; bankDataId: string }
   */
  async pollIlumaResult(data: { requestId: string; bankDataId: string }) {
    try {
      if (!data) {
        return;
      }

      const { requestId, bankDataId } = data;
      if (!requestId || !bankDataId) {
        return;
      }

      // Get the related BankData record
      const bankDataRecord = await this.repositoryBankData.findOne({
        where: { id: bankDataId },
      });

      if (!bankDataRecord) {
        return;
      }

      // If already completed or expired, nothing to do
      if (
        bankDataRecord.accountStatus === 'completed' ||
        bankDataRecord.accountStatus === 'expired'
      ) {
        return;
      }

      // Check BankData first (webhook may have updated it)
      const refreshedBankData = await this.repositoryBankData.findOne({
        where: { id: bankDataId },
      });

      if (
        refreshedBankData &&
        refreshedBankData.accountStatus === 'completed'
      ) {
        const bdStatus =
          refreshedBankData.accountResult === 'success' ? 'success' : 'failed';

        await this.updateBankDataStatus(
          refreshedBankData.id,
          bdStatus,
          refreshedBankData.ilumaData || null,
          'worker',
        );

        return;
      }

      const resultUrl = `${this.ilumaBaseUrl}/bank_account_validation_details/${requestId}`;
      const check = await this.ilumaGet(resultUrl);

      // Phase E.2.6 – log normalized Iluma worker polling errors (if any)
      if ((check as any).error) {
        this.logInternal('Worker Iluma polling error (normalized)', {
          requestId,
          bankDataId,
          error: (check as any).error,
        });
      }

      // Worker logs masked only
      const masked = {
        bank_code: null,
      };

      const loopLog = {
        url:
          'https://api.iluma.ai/v1.2/identity/bank_account_validation_details/' +
          requestId,
        func: 'get-result-worker',
        payload: masked,
        method: 'post',
        response: check,
        createdAt: moment().toISOString(),
        updatedAt: moment().toISOString(),
      };
      await this.writeIlumaLog(
        loopLog.url,
        loopLog.func,
        loopLog.payload,
        loopLog.response,
      );

      if (check.status !== 200) {
        return;
      }

      const respData = check.data;
      if (!respData || !respData.status) {
        return;
      }

      await this.pollUntilDone(requestId, bankDataId);
    } catch (e) {
      // Swallow errors; worker failures should not affect callers.
      return;
    }
  }

  async ilumaBankValidator(data) {
    try {
      this.logInternal('Webhook received', { requestId: data?.id });

      // Update IlumaCallback (audit log)
      const callbackEntry = await this.repositoryCallback.findOne({
        where: { requestNumber: data.id },
      });

      if (callbackEntry) {
        const callbackUpdate = {
          response: data,
          responseAt: moment().format('YYYY-MM-DD HH:mm:ss'),
          updatedAt: moment().toISOString(),
        };
        await this.repositoryCallback.update(callbackEntry.id, callbackUpdate);
      }

      // Update BankData based on requestId
      const bankDataRecord = await this.repositoryBankData.findOne({
        where: { requestId: data.id },
      });

      if (!bankDataRecord) {
        // Early webhook — BankData not yet created
        return { message: 'Ignored' };
      }

      // F.2.4 – Ignore webhook if BankData is not pending
      if (bankDataRecord.accountStatus !== 'pending') {
        this.logInternal('Webhook ignored due to non-pending BankData', {
          id: bankDataRecord.id,
          status: bankDataRecord.accountStatus,
        });
        return { message: 'Ignored' };
      }

      // Determine status
      let finalStatus: 'success' | 'failed' = 'failed';

      if (data.status && data.status.toLowerCase() === 'completed') {
        finalStatus = this.computeFinalStatus(
          this.normalizeIlumaResponse(data),
        );
      }

      this.logInternal('BankData state transition', {
        id: bankDataRecord.id,
        from: bankDataRecord.accountStatus,
        to: 'completed',
        resultStatus: finalStatus,
        source: 'webhook',
      });

      // Update BankData
      await this.repositoryBankData.update(bankDataRecord.id, {
        accountStatus: 'completed',
        accountResult: finalStatus,
        ilumaData: this.normalizeIlumaResponse(data) as any,
        failureCode: data?.result?.error_code || null,
        failureMessage: data?.result?.message || null,
        updatedAt: moment().toISOString(),
        lastCheckAt: moment().toISOString(),
      });

      // Webhook always acknowledges
      return { message: 'OK' };
    } catch (e) {
      // Phase E.2.6 – log webhook handler errors but never fail Iluma callback
      this.logInternal('Webhook handler error', {
        error: e?.message || e,
      });
      // NEVER return 500 to Iluma. Always return OK to avoid retry spam.
      return { message: 'OK' };
    }
  }

  /**
   * Centralized error handler for checkAccount() (Phase E.2.5)
   * Converts normalized IlumaError into public shape when possible.
   */
  private handleCheckAccountError(e: any) {
    try {
      // If this is already a normalized Iluma error
      if (e && e.code && e.httpStatus) {
        this.logInternal('checkAccount() caught normalized IlumaError', e);

        const result = {
          retCode: -1,
          retMsg: e.message || 'Iluma error',
          errorCode: e.code || 'ILUMA_ERROR',
        };

        throw new HttpException(result, HttpStatus.OK);
      }

      // If this error came from ilumaPost/ilumaGet (wrapped shape)
      if (e?.data?.code && e?.data?.httpStatus) {
        const err = e.data;

        this.logInternal('checkAccount() caught wrapped IlumaError', err);

        const result = {
          retCode: -1,
          retMsg: err.message || 'Iluma error',
          errorCode: err.code || 'ILUMA_ERROR',
        };

        throw new HttpException(result, HttpStatus.OK);
      }

      // Fallback: generic internal error
      this.logInternal('checkAccount() internal error', {
        message: e?.message,
      });

      const result = {
        retCode: -1,
        retMsg: e?.message || 'Unknown error',
      };
      throw new HttpException(result, HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (err) {
      // Re-throw transformed HttpException
      throw err;
    }
  }
}
