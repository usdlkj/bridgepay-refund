import { RefundNotificationService } from './refund-notification.service';

const LEASE = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';

// A scripted manager: each rule maps an SQL fragment to rows; every statement is recorded.
function setup(
  rules: Record<string, any[]> = {},
  env: Record<string, any> = {},
) {
  const calls: { sql: string; params: any[] }[] = [];
  const query = jest.fn(async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const hit = Object.keys(rules).find((k) => sql.includes(k));
    return hit ? rules[hit] : [];
  });
  const manager = { query } as any;
  const db = { query, transaction: (cb: any) => cb(manager) } as any;
  const config = { get: (k: string) => env[k] } as any;
  const service = new RefundNotificationService(db, config);
  const ran = (fragment: string) =>
    calls.filter((c) => c.sql.includes(fragment));
  return { service, manager, calls, ran };
}

const row = (over: Record<string, any> = {}) => ({
  id: ID,
  refund_id: 'R1',
  type: 'success',
  payload: { retData: {} },
  created_at: new Date(),
  attempts: 1,
  max_attempts: 2,
  state: 'running',
  ...over,
});

describe('RefundNotificationService', () => {
  it('allows one retry (2 attempts), with a 60 s lease and delay', () => {
    const { service } = setup();
    expect(service.maxAttempts).toBe(2);
    expect(service.leaseMs).toBe(60000);
    expect(service.retryDelayMs).toBe(60000);
    expect(service.agedMs).toBe(300000);
  });

  it('rejects an invalid setting at startup', () => {
    expect(() => setup({}, { NOTIFICATION_LEASE_MS: 5 })).toThrow(
      'Invalid NOTIFICATION_LEASE_MS',
    );
  });

  describe('enqueue', () => {
    it('inserts one pending intent and ignores an in-flight duplicate', async () => {
      const { service, manager, ran } = setup({
        'INSERT INTO refund_notifications': [{ id: 'x' }],
      });
      const id = await service.enqueue(
        manager,
        { id: 'R1' },
        'success',
        'https://t/n',
        { a: 1 },
      );
      expect(id).toBe('x');
      const insert = ran('INSERT INTO refund_notifications')[0];
      expect(insert.sql).toContain(
        'ON CONFLICT (refund_id, type) WHERE state IN',
      );
      expect(insert.params.slice(1)).toEqual([
        'R1',
        'success',
        'https://t/n',
        '{"a":1}',
        2,
        60000,
      ]);
    });

    it('returns null when an in-flight intent already exists', async () => {
      const { service, manager } = setup();
      expect(
        await service.enqueue(manager, { id: 'R1' }, 'fail', 'https://t/n', {}),
      ).toBeNull();
    });

    it('queues both notice types with 2 attempts', async () => {
      const { service, manager, ran } = setup({
        'INSERT INTO refund_notifications': [{ id: 'x' }],
      });
      await service.enqueue(manager, { id: 'R1' }, 'fail', 'https://t/n', {});
      await service.enqueue(
        manager,
        { id: 'R2' },
        'success',
        'https://t/n',
        {},
      );
      const [fail, success] = ran('INSERT INTO refund_notifications');
      expect(fail.params[5]).toBe(2);
      expect(success.params[5]).toBe(2);
    });

    it('lets the retry count be configured and rejects an invalid one', () => {
      expect(
        setup({}, { REFUND_NOTIFICATION_RETRIES: 3 }).service.maxAttempts,
      ).toBe(4);
      expect(() => setup({}, { REFUND_NOTIFICATION_RETRIES: 0 })).toThrow(
        'Invalid REFUND_NOTIFICATION_RETRIES',
      );
    });

    it('refuses a refund without a notify URL', async () => {
      const { service, manager } = setup();
      await expect(
        service.enqueue(manager, { id: 'R1' }, 'success', '', {}),
      ).rejects.toThrow('no notifyUrl');
    });
  });

  describe('claim', () => {
    it('skips a notification whose refund is no longer in the expected status', async () => {
      const { service, ran } = setup({
        'FROM refund_notifications': [row({ state: 'pending' })],
        'FROM refunds': [
          { id: 'R1', refund_ga_number: 'GA1', refund_status: 'done' },
        ],
      });
      expect(await service.claim()).toBeNull();
      expect(ran("state='skipped'")).toHaveLength(1);
    });

    it('claims a due success notification and increments the attempt', async () => {
      const { service, ran } = setup({
        'FROM refund_notifications': [row({ state: 'pending', attempts: 0 })],
        'FROM refunds': [
          { id: 'R1', refund_ga_number: 'GA1', refund_status: 'success' },
        ],
        "SET state='running'": [row({ attempts: 1, lease_token: LEASE })],
      });
      const claimed: any = await service.claim();
      expect(claimed.refundNumber).toBe('GA1');
      expect(claimed.attempts).toBe(1);
      expect(ran("state='running', attempts=attempts+1")[0].params[2]).toBe(
        60000,
      );
    });

    it('expects status fail for a fail notification', async () => {
      const { service, ran } = setup({
        'FROM refund_notifications': [
          row({ type: 'fail', state: 'pending', attempts: 0 }),
        ],
        'FROM refunds': [
          { id: 'R1', refund_ga_number: 'GA1', refund_status: 'success' },
        ],
      });
      expect(await service.claim()).toBeNull();
      expect(ran("state='skipped'")).toHaveLength(1);
    });
  });

  describe('finish', () => {
    const owned = (r: any, status: string) => ({
      'FROM refund_notifications WHERE id=$1': [r],
      'FROM refunds WHERE id=$1': [{ id: 'R1', refund_status: status }],
    });

    it('marks the refund done when Ticketing accepts the success notice', async () => {
      const { service, ran } = setup(owned(row(), 'success'));
      await service.finish({
        id: ID,
        leaseToken: LEASE,
        success: true,
        response: { retCode: 0 },
      });
      expect(ran('UPDATE refunds SET refund_status')[0].params).toEqual([
        'R1',
        'done',
      ]);
      expect(ran('refund_notification_alerts')).toHaveLength(0);
    });

    it('with more than 2 attempts configured, alerts repeated-failure from the second failure', async () => {
      const first = setup(
        owned(row({ attempts: 1, max_attempts: 4 }), 'success'),
      );
      await first.service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'HTTP 500',
      });
      expect(
        first
          .ran('UPDATE refund_notifications SET state=$2')[0]
          .params.slice(1),
      ).toEqual(['pending', 'HTTP 500']);
      expect(first.ran('INSERT INTO refund_notification_alerts')).toHaveLength(
        0,
      );
      expect(first.ran('UPDATE refunds SET refund_status')).toHaveLength(0);

      const second = setup(
        owned(row({ attempts: 2, max_attempts: 4 }), 'success'),
      );
      await second.service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'HTTP 500',
      });
      expect(
        second.ran('INSERT INTO refund_notification_alerts')[0].params[1],
      ).toBe('repeated-failure');
    });

    it('sets ticketingFailed and alerts retry-exhausted when the success notice runs out of attempts', async () => {
      const { service, ran } = setup(owned(row({ attempts: 2 }), 'success'));
      await service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'timeout',
      });
      expect(ran('UPDATE refunds SET refund_status')[0].params).toEqual([
        'R1',
        'ticketingFailed',
      ]);
      expect(ran('INSERT INTO refund_notification_alerts')[0].params[1]).toBe(
        'retry-exhausted',
      );
      expect(ran('UPDATE refund_notifications SET state=$2')[0].params[1]).toBe(
        'failed',
      );
    });

    it('keeps status fail when the fail notice runs out of attempts', async () => {
      const { service, ran } = setup(
        owned(row({ type: 'fail', attempts: 2 }), 'fail'),
      );
      await service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'timeout',
      });
      expect(ran('UPDATE refunds SET refund_status')).toHaveLength(0);
      expect(ran('INSERT INTO refund_notification_alerts')[0].params[1]).toBe(
        'retry-exhausted',
      );
    });

    it('retries a rejected fail notice once, then alerts retry-exhausted and keeps status fail', async () => {
      const first = setup(
        owned(row({ type: 'fail', attempts: 1, max_attempts: 2 }), 'fail'),
      );
      await first.service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'signature',
      });
      expect(
        first.ran('UPDATE refund_notifications SET state=$2')[0].params[1],
      ).toBe('pending');
      expect(first.ran('INSERT INTO refund_notification_alerts')).toHaveLength(
        0,
      );

      const second = setup(
        owned(row({ type: 'fail', attempts: 2, max_attempts: 2 }), 'fail'),
      );
      await second.service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'signature',
      });
      expect(
        second.ran('UPDATE refund_notifications SET state=$2')[0].params[1],
      ).toBe('failed');
      expect(
        second.ran('INSERT INTO refund_notification_alerts')[0].params[1],
      ).toBe('retry-exhausted');
      expect(second.ran('UPDATE refunds SET refund_status')).toHaveLength(0);
    });

    it('leaves status fail after a delivered fail notice', async () => {
      const { service, ran } = setup(owned(row({ type: 'fail' }), 'fail'));
      await service.finish({
        id: ID,
        leaseToken: LEASE,
        success: true,
        response: { retCode: 0 },
      });
      expect(ran('UPDATE refunds SET refund_status')).toHaveLength(0);
      expect(ran('UPDATE refund_notifications SET state=$2')[0].params[1]).toBe(
        'done',
      );
    });

    it('records one notif_log entry per attempt and masks URLs in the reason', async () => {
      const { service, ran } = setup(owned(row({ attempts: 1 }), 'success'));
      await service.finish({
        id: ID,
        leaseToken: LEASE,
        success: false,
        reason: 'failed https://secret.example/x?k=1\nstack',
      });
      const log = ran('UPDATE refunds SET notif_log')[0];
      const entry = JSON.parse(log.params[1])[0];
      expect(entry).toMatchObject({
        notificationId: ID,
        attemptNo: 1,
        status: 'fail',
        reason: 'failed [URL]',
      });
    });

    it('skips instead of overwriting when the refund moved on', async () => {
      const { service, ran } = setup(owned(row(), 'done'));
      await service.finish({ id: ID, leaseToken: LEASE, success: true });
      expect(ran("state='skipped'")).toHaveLength(1);
      expect(ran('UPDATE refunds')).toHaveLength(0);
    });

    it('refuses a finish without the lease', async () => {
      const { service } = setup({});
      await expect(
        service.finish({ id: ID, leaseToken: LEASE, success: true }),
      ).rejects.toThrow('lease is no longer owned');
    });

    it('refuses malformed identifiers', async () => {
      const { service } = setup({});
      await expect(
        service.finish({ id: 'x', leaseToken: LEASE, success: true }),
      ).rejects.toThrow('Invalid notification identifier');
    });
  });

  describe('monitor', () => {
    it('raises one aged alert per old notification and returns undelivered alerts', async () => {
      const { service, ran } = setup({
        'FROM refund_notifications WHERE state IN': [row({ state: 'pending' })],
        'FROM refund_notification_alerts a': [{ id: 7, kind: 'aged' }],
      });
      const alerts = await service.monitor();
      expect(ran('INSERT INTO refund_notification_alerts')[0].params[1]).toBe(
        'aged',
      );
      expect(alerts).toEqual([{ id: 7, kind: 'aged' }]);
    });
  });
});
