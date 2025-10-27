import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761549869089 implements MigrationInterface {
    name = 'Migration1761549869089'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "refund_logs" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, "location" character varying NOT NULL, "detail" text NOT NULL, "msg" text NOT NULL, "notes" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d3242b85309733c792e868c0dfa" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "refund_logs"`);
    }

}
