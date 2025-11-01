import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1757650042288 implements MigrationInterface {
  name = 'Migration1757650042288';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refunds" ("id" SERIAL NOT NULL, "refund_id" character varying, "refund_status" character varying DEFAULT 'rbdApproval', "refund_amount" numeric, "refund_amount_data" jsonb, "refund_data" jsonb, "refund_reason" character varying, "reject_reason" character varying, "reject_by" character varying, "approval_fin_by" character varying, "approval_rbd_by" character varying, "approval_fin_at" TIMESTAMP WITH TIME ZONE, "approval_rbd_at" TIMESTAMP WITH TIME ZONE, "reject_at" TIMESTAMP WITH TIME ZONE, "refund_bank_data" jsonb, "refund_date" TIMESTAMP WITH TIME ZONE, "request_data" jsonb, "pg_callback" jsonb, "retry_attempt" jsonb, "retry_date" TIMESTAMP WITH TIME ZONE, "target_refund_date" TIMESTAMP WITH TIME ZONE, "refund_execute_data" jsonb, "notif_log" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "refund_detail_id" integer, CONSTRAINT "PK_5106efb01eeda7e49a78b869738" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_b7468cb5e2c7cb9b34953c7ccb4" FOREIGN KEY ("refund_detail_id") REFERENCES "refund_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refunds" DROP CONSTRAINT "FK_b7468cb5e2c7cb9b34953c7ccb4"`,
    );
    await queryRunner.query(`DROP TABLE "refunds"`);
  }
}
