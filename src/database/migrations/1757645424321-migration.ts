import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757645424321 implements MigrationInterface {
    name = 'Migration1757645424321'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reports" ("id" SERIAL NOT NULL, "name" character varying, "refund_start_date" date, "refund_end_date" date, "report_data" jsonb, "report_type" text NOT NULL DEFAULT 'refund', "report_status" text NOT NULL DEFAULT 'process', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "report_data_rows" ("id" SERIAL NOT NULL, "seq_no" integer, "refund_date" character varying, "cancel_time" character varying, "refund_type" character varying, "refund_person" character varying, "refund_charge" numeric, "refund_charge_tax" numeric, "refund_amount" numeric, "refund_trande_no" character varying, "plat_trade_no" character varying, "refund_bank_code" character varying, "refund_bank_name" character varying, "refund_account" character varying, "refund_account_name" character varying, "actual_refund_amount" numeric, "passenger_name" character varying, "encrypted_id_number" character varying, "nationality" character varying, "order_number" character varying, "ticket_no" character varying, "ticketing_station" character varying, "business_area" character varying, "office_no" character varying, "window_no" character varying, "shift_no" character varying, "operator_name" character varying, "ticketing_time" character varying, "departure_time" character varying, "train_no" character varying, "origin" character varying, "cars_number" character varying, "seat_number" character varying, "origin_code" character varying, "purchase_date" character varying, "destination" character varying, "destination_code" character varying, "arrival_time" character varying, "seat_class" character varying, "ticket_type" character varying, "original_ticket_price" character varying, "report_id" integer, CONSTRAINT "PK_7eb02fd9b80283c9eeb1913fcb8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refund_detail_tickets" ("id" SERIAL NOT NULL, "arrival_station" character varying, "cars_number" character varying, "departure_date" date, "departure_station" character varying, "identity_number" character varying, "identity_type" character varying, "name" character varying, "order_number" character varying, "purchase_price" numeric, "seat_number" character varying, "ticket_class" character varying, "ticket_number" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "refund_detail_id" integer, CONSTRAINT "PK_300a3105c65e6a73bb2edb65c8f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refund_details" ("id" SERIAL NOT NULL, "refund_mw_id" integer, "email" character varying, "phone_number" character varying, "reason" character varying, "refund_id" character varying, "refund_amount" numeric, "ticket_office" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_647da5b1982b07a1411f942fcb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refund_banks" ("id" SERIAL NOT NULL, "bank_name" character varying NOT NULL, "xendit_code" character varying, "xendit_data" jsonb, "iluma_code" character varying, "iluma_data" jsonb, "bank_status" character varying NOT NULL DEFAULT 'disable', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e1234a62c03f16b506f6654db1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "iluma_callbacks" ("id" SERIAL NOT NULL, "callback_type" character varying, "request_number" character varying, "payload" jsonb, "response" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4044e69e7b9c854ea7a9c5f9225" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "report_data_rows" ADD CONSTRAINT "FK_11b3f2f2798db9282fb32d945d6" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refund_detail_tickets" ADD CONSTRAINT "FK_a21a22b07192873b4d37ecb71ce" FOREIGN KEY ("refund_detail_id") REFERENCES "refund_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        
        await queryRunner.query(`ALTER TABLE "refund_detail_tickets" DROP CONSTRAINT "FK_a21a22b07192873b4d37ecb71ce"`);
        await queryRunner.query(`ALTER TABLE "report_data_rows" DROP CONSTRAINT "FK_11b3f2f2798db9282fb32d945d6"`);
        await queryRunner.query(`DROP TABLE "iluma_callbacks"`);
        await queryRunner.query(`DROP TABLE "refund_banks"`);
        await queryRunner.query(`DROP TABLE "refund_details"`);
        await queryRunner.query(`DROP TABLE "refund_detail_tickets"`);
        await queryRunner.query(`DROP TABLE "report_data_rows"`);
        await queryRunner.query(`DROP TABLE "reports"`);
    }

}
