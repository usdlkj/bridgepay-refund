import { MigrationInterface, QueryRunner } from 'typeorm';

// Mirrors Core's payment_notifications outbox (migration 1791504000000).
export class RefundNotificationOutbox1791676800000
  implements MigrationInterface
{
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE refund_notifications (
      id uuid PRIMARY KEY,
      refund_id varchar NOT NULL REFERENCES refunds(id),
      type text NOT NULL CHECK (type IN ('success','fail')),
      notify_url text NOT NULL,
      payload jsonb NOT NULL,
      state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','done','failed','skipped')),
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      max_attempts integer NOT NULL CHECK (max_attempts > 0),
      retry_delay_ms integer NOT NULL CHECK (retry_delay_ms >= 0),
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      lease_token uuid,
      lease_until timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    // A refund may be notified again after a deliberate Backoffice retry, so uniqueness covers in-flight rows only.
    await q.query(`CREATE UNIQUE INDEX refund_notifications_in_flight ON refund_notifications (refund_id, type)
      WHERE state IN ('pending','running')`);
    await q.query(`CREATE INDEX refund_notifications_due ON refund_notifications (next_attempt_at, created_at)
      WHERE state IN ('pending','running')`);
    await q.query(`CREATE TABLE refund_notification_alerts (
      id bigserial PRIMARY KEY,
      notification_id uuid NOT NULL REFERENCES refund_notifications(id),
      kind text NOT NULL,
      delivered_at timestamptz,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (notification_id, kind)
    )`);
    // Run as postgres; the Refund runtime role must read and write the outbox.
    await q.query(
      `GRANT SELECT, INSERT, UPDATE ON refund_notifications, refund_notification_alerts TO kcic_refund_user`,
    );
    await q.query(
      `GRANT USAGE, SELECT ON SEQUENCE refund_notification_alerts_id_seq TO kcic_refund_user`,
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'Refund notification outbox rollback requires reconciliation; retain accepted work and deploy compatible consumers.',
    );
  }
}
