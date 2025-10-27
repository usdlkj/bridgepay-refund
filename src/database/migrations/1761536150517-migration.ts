import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761536150517 implements MigrationInterface {
    name = 'Migration1761536150517'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."payment_gateways_status_enum" AS ENUM('production', 'development', 'disable')`);
        await queryRunner.query(`CREATE TABLE "payment_gateways" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pgCode" character varying NOT NULL, "pgName" character varying NOT NULL, "credential" text NOT NULL, "credentialEncrypted" text, "status" "public"."payment_gateways_status_enum" NOT NULL DEFAULT 'development', "weight" integer NOT NULL, "percentageRange" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_22b634e0584563141ab7919abcf" UNIQUE ("pgCode"), CONSTRAINT "PK_2b022a3aafb792a1afe3e14e06f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_22b634e0584563141ab7919abc" ON "payment_gateways" ("pgCode") `);
        await queryRunner.query(`CREATE TABLE "configurations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "configName" character varying NOT NULL, "configValue" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ef9fc29709cc5fc66610fc6a664" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."api_log_debugs_signaturestatus_enum" AS ENUM('accepted', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "api_log_debugs" ("id" SERIAL NOT NULL, "endpoint" character varying NOT NULL, "payload" text NOT NULL, "signature" text NOT NULL, "signatureStatus" "public"."api_log_debugs_signaturestatus_enum" NOT NULL, "rawPayload" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6d5e736721c8688b66669b59efd" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "api_log_debugs"`);
        await queryRunner.query(`DROP TYPE "public"."api_log_debugs_signaturestatus_enum"`);
        await queryRunner.query(`DROP TABLE "configurations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_22b634e0584563141ab7919abc"`);
        await queryRunner.query(`DROP TABLE "payment_gateways"`);
        await queryRunner.query(`DROP TYPE "public"."payment_gateways_status_enum"`);
    }

}
