import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761618405179 implements MigrationInterface {
    name = 'Migration1761618405179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ticketing-call-logs" ("id" SERIAL NOT NULL, "refund_number" character varying NOT NULL, "payload" jsonb NOT NULL, "response" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_78b4c04bad141496ea0b14c496b" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "ticketing-call-logs"`);
    }

}
