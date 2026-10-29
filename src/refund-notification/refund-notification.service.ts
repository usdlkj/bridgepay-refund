import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RefundNotificationType = 'success' | 'fail';

// The refund status each notification type is allowed to act on.
const expectedStatus: Record<RefundNotificationType, string> = {
  success: 'success',
  fail: 'fail',
};

// Outbox for Ticketing refund notifications; a copy of Core's PaymentNotificationService.
@Injectable()
export class RefundNotificationService {
  private readonly logger = new Logger(RefundNotificationService.name);
  readonly leaseMs: number;
  readonly retryDelayMs: number;
  readonly maxAttempts: number;
  readonly agedMs: number;

  constructor(
    private readonly db: DataSource,
    config: ConfigService,
  ) {
    const integer = (
      key: string,
      fallback: number,
      min: number,
      max: number,
    ) => {
      const n = Number(config.get(key) ?? fallback);
      if (!Number.isSafeInteger(n) || n < min || n > max)
        throw new Error(`Invalid ${key}`);
      return n;
    };
    this.leaseMs = integer('NOTIFICATION_LEASE_MS', 60000, 1000, 300000);
    this.retryDelayMs = integer(
      'RETRY_PUSH_DATA_QUEUE_DELAY',
      60000,
      0,
      3600000,
    );
    // One retry: two rejections at different times point to an internal problem, not a transient one.
    this.maxAttempts = integer('REFUND_NOTIFICATION_RETRIES', 1, 1, 9) + 1;
    this.agedMs = integer('NOTIFICATION_AGED_MS', 300000, 1000, 86400000);
  }

  private trace(event: string, row: any) {
    this.logger.log({
      event,
      notificationId: row.id,
      refundId: row.refund_id,
      type: row.type,
      attempt: row.attempts,
      state: row.state,
    });
  }

  private validateId(id: string) {
    if (!uuid.test(id ?? ''))
      throw new RpcException('Invalid notification identifier');
  }

  // Called inside the transaction that sets the refund status, so the intent is durable with the outcome.
  async enqueue(
    m: EntityManager,
    refund: { id: string; refundId?: string },
    type: RefundNotificationType,
    notifyUrl: string,
    payload: Record<string, any>,
  ) {
    if (typeof notifyUrl !== 'string' || !notifyUrl.trim())
      throw new Error('Refund has no notifyUrl');
    const id = randomUUID();
    const rows = await m.query(
      `INSERT INTO refund_notifications (id,refund_id,type,notify_url,payload,max_attempts,retry_delay_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (refund_id, type) WHERE state IN ('pending','running') DO NOTHING RETURNING id`,
      [
        id,
        refund.id,
        type,
        notifyUrl,
        JSON.stringify(payload),
        this.maxAttempts,
        this.retryDelayMs,
      ],
    );
    if (rows.length)
      this.trace('refund-notification-queued', {
        id,
        refund_id: refund.id,
        type,
        attempts: 0,
        state: 'pending',
      });
    return rows[0]?.id ?? null;
  }

  async claim() {
    return this.db.transaction(async (m) => {
      const [row] = await m.query(`SELECT * FROM refund_notifications
        WHERE (state='pending' AND next_attempt_at<=now()) OR (state='running' AND lease_until<=now())
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`);
      if (!row) return null;
      const [refund] = await m.query(
        'SELECT id, refund_ga_number, refund_status FROM refunds WHERE id=$1 FOR UPDATE',
        [row.refund_id],
      );
      if (
        !refund ||
        refund.refund_status !==
          expectedStatus[row.type as RefundNotificationType]
      ) {
        await m.query(
          `UPDATE refund_notifications SET state='skipped',updated_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1`,
          [row.id],
        );
        return null;
      }
      if (row.attempts >= row.max_attempts) {
        await this.complete(m, row, {
          success: false,
          reason:
            'Lease expired after final attempt; ticketing outcome requires reconciliation',
          response: null,
        });
        return null;
      }
      const [claimed] = await m.query(
        `UPDATE refund_notifications SET state='running', attempts=attempts+1,
        lease_token=$2,lease_until=now()+($3 * interval '1 millisecond'),updated_at=now()
        WHERE id=$1 RETURNING *`,
        [row.id, randomUUID(), this.leaseMs],
      );
      this.trace('refund-notification-claimed', claimed);
      return { ...claimed, refundNumber: refund.refund_ga_number };
    });
  }

  private async owned(
    m: EntityManager,
    data: { id: string; leaseToken: string },
  ) {
    this.validateId(data.id);
    this.validateId(data.leaseToken);
    const [row] = await m.query(
      `SELECT * FROM refund_notifications WHERE id=$1
      AND state='running' AND lease_token=$2 AND lease_until>now() FOR UPDATE`,
      [data.id, data.leaseToken],
    );
    if (!row) throw new RpcException('Notification lease is no longer owned');
    return row;
  }

  async finish(data: {
    id: string;
    leaseToken: string;
    success: boolean;
    reason?: string;
    response?: any;
  }) {
    if (typeof data.success !== 'boolean')
      throw new RpcException('Invalid notification outcome');
    if (JSON.stringify(data.response ?? null).length > 16384)
      throw new RpcException('Notification response too large');
    return this.db.transaction(async (m) => {
      const row = await this.owned(m, data);
      await this.complete(m, row, data);
      return { accepted: true };
    });
  }

  private async alert(m: EntityManager, row: any, kind: string) {
    const message = `Refund notification ${kind}: notification=${row.id}, refund=${row.refund_id}, type=${row.type}, attempts=${row.attempts}`;
    await m.query(
      `INSERT INTO refund_notification_alerts (notification_id,kind,message)
      VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
      [row.id, kind, message],
    );
  }

  private async complete(m: EntityManager, row: any, data: any) {
    const type = row.type as RefundNotificationType;
    const [refund] = await m.query(
      'SELECT id, refund_status FROM refunds WHERE id=$1 FOR UPDATE',
      [row.refund_id],
    );
    if (!refund || refund.refund_status !== expectedStatus[type]) {
      await m.query(
        `UPDATE refund_notifications SET state='skipped',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1`,
        [row.id],
      );
      return;
    }
    const reason = data.success
      ? null
      : String(data.reason ?? 'ticketing-delivery-failed')
          .split('\n')[0]
          .replace(/https?:\/\/\S+/g, '[URL]')
          .slice(0, 500);
    const exhausted = !data.success && row.attempts >= row.max_attempts;
    const state = data.success ? 'done' : exhausted ? 'failed' : 'pending';
    await m.query(
      `UPDATE refund_notifications SET state=$2,last_error=$3,lease_token=NULL,lease_until=NULL,
      next_attempt_at=now()+(retry_delay_ms * interval '1 millisecond'),updated_at=now() WHERE id=$1`,
      [row.id, state, reason],
    );
    const entry = {
      notificationId: row.id,
      type,
      attemptNo: row.attempts,
      payload: row.payload,
      initAt: row.created_at,
      responseData: data.response ?? null,
      responseAt: new Date(),
      status: data.success ? 'success' : 'fail',
      reason,
    };
    await m.query(
      `UPDATE refunds SET notif_log = (COALESCE(notif_log::jsonb,'[]'::jsonb) || $2::jsonb)::json,
      updated_at=now() WHERE id=$1`,
      [row.refund_id, JSON.stringify([entry])],
    );
    // Success notice done -> done; success notice exhausted -> ticketingFailed. A fail notice never changes
    // the status: the downstream cause (fail) must not be overwritten.
    if (type === 'success' && (data.success || exhausted)) {
      await m.query(
        'UPDATE refunds SET refund_status=$2, updated_at=now() WHERE id=$1',
        [row.refund_id, data.success ? 'done' : 'ticketingFailed'],
      );
    }
    if (exhausted || (!data.success && row.attempts >= 2))
      await this.alert(
        m,
        row,
        exhausted ? 'retry-exhausted' : 'repeated-failure',
      );
    this.trace('refund-notification-outcome', { ...row, state });
  }

  async monitor() {
    return this.db.transaction(async (m) => {
      const rows = await m.query(
        `SELECT * FROM refund_notifications WHERE state IN ('pending','running')
        AND NOT EXISTS (SELECT 1 FROM refund_notification_alerts a WHERE a.notification_id=refund_notifications.id AND a.kind='aged')
        AND created_at<=now()-($1 * interval '1 millisecond') ORDER BY created_at LIMIT 100`,
        [this.agedMs],
      );
      for (const row of rows) await this.alert(m, row, 'aged');
      return m.query(`SELECT a.*, r.refund_ga_number AS "refundNumber" FROM refund_notification_alerts a
        JOIN refund_notifications n ON n.id=a.notification_id JOIN refunds r ON r.id=n.refund_id
        WHERE a.delivered_at IS NULL ORDER BY a.id LIMIT 20`);
    });
  }

  async markAlertDelivered(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new RpcException('Invalid alert identifier');
    await this.db.query(
      'UPDATE refund_notification_alerts SET delivered_at=now() WHERE id=$1',
      [id],
    );
    return { accepted: true };
  }

  async health() {
    await this.db.query('SELECT id FROM refund_notifications LIMIT 1');
    await this.db.query('SELECT id FROM refund_notification_alerts LIMIT 1');
    return { status: 'ok', leaseMs: this.leaseMs };
  }
}
