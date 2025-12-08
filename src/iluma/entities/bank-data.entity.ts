import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ulid } from 'ulid';

@Entity('bank_datas')
@Index(['bankCode', 'accountNumberHash'], { unique: true })
export class BankData {
  @PrimaryColumn()
  id: string;

  // Bank code (e.g., Xendit bank code)
  @Column({ name: 'bank_code', type: 'varchar', nullable: false })
  bankCode: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  // Encrypted value (never plaintext)
  @Column({ name: 'account_number_enc', type: 'jsonb', nullable: true })
  accountNumberEnc: any;

  // Hash of account number for search
  @Column({ name: 'account_number_hash', nullable: false, type: 'varchar' })
  accountNumberHash: string;

  @Column({ name: 'request_id', type: 'varchar', nullable: true })
  requestId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'expired'],
    name: 'account_status',
  })
  accountStatus: string;

  @Column({
    type: 'enum',
    enum: ['success', 'failed', 'pending'],
    name: 'account_result',
    nullable: true,
  })
  accountResult: string;

  @Column({ type: 'jsonb', nullable: true, name: 'iluma_data' })
  ilumaData: any;

  // Extracted fields for operational failure diagnostics
  @Column({ name: 'failure_code', type: 'varchar', nullable: true })
  failureCode?: string;

  @Column({ name: 'failure_message', type: 'text', nullable: true })
  failureMessage?: string;

  @Column({ name: 'last_check_at', type: 'timestamptz', nullable: true })
  lastCheckAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
