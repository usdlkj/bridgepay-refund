import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761617488026 implements MigrationInterface {
    name = 'Migration1761617488026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payment_gateways_status_enum" AS ENUM('production', 'development', 'disable')`);
        await queryRunner.query(`CREATE TABLE "payment_gateways" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pg_code" character varying NOT NULL, "pg_name" character varying NOT NULL, "credential" text NOT NULL, "credential_encrypted" text, "status" "public"."payment_gateways_status_enum" NOT NULL DEFAULT 'development', "weight" integer NOT NULL, "percentage_range" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_8b85598b98f729a67fbd9c39b00" UNIQUE ("pg_code"), CONSTRAINT "PK_2b022a3aafb792a1afe3e14e06f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b85598b98f729a67fbd9c39b0" ON "payment_gateways" ("pg_code") `);
        await queryRunner.query(`CREATE TABLE "configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "config_name" character varying NOT NULL, "config_value" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ef9fc29709cc5fc66610fc6a664" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."api_log_debugs_signature_status_enum" AS ENUM('accepted', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "api_log_debugs" ("id" SERIAL NOT NULL, "endpoint" character varying NOT NULL, "payload" text NOT NULL, "signature" text NOT NULL, "signature_status" "public"."api_log_debugs_signature_status_enum" NOT NULL, "raw_payload" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6d5e736721c8688b66669b59efd" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "api_log_debugs"`);
        await queryRunner.query(`DROP TYPE "public"."api_log_debugs_signature_status_enum"`);
        await queryRunner.query(`DROP TABLE "configurations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b85598b98f729a67fbd9c39b0"`);
        await queryRunner.query(`DROP TABLE "payment_gateways"`);
        await queryRunner.query(`DROP TYPE "public"."payment_gateways_status_enum"`);
    }

}
