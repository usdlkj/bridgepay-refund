import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1758010525492 implements MigrationInterface {
  name = 'Migration1758010525492';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "iluma_call_logs" ("id" SERIAL NOT NULL, "url" character varying NOT NULL, "method" text NOT NULL, "payload" jsonb, "response" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_89aa62944713ac3a1d732359627" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "iluma_call_logs"`);
  }
}
