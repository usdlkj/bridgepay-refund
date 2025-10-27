import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761544888122 implements MigrationInterface {
    name = 'Migration1761544888122'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bank_datas" ("id" SERIAL NOT NULL, "account_number" character varying NOT NULL, "account_status" character varying NOT NULL, "account_result" character varying, "iluma_data" jsonb, "last_check_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_21c55d737e433eef30f85a82167" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "bank_datas"`);
    }

}
