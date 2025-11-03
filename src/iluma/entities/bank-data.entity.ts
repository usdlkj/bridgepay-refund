import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ulid } from 'ulid';

@Entity('bank_datas')
export class BankData {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  @Column({ name: 'account_number' })
  accountNumber: string;

  @Column({
    enum: ['pending', 'completed'],
    name: 'account_status',
  })
  accountStatus: string;

  @Column({
    name: 'account_result',
    enum: ['success', 'failed'],
    nullable: true,
  })
  accountResult: string;

  @Column({ type: 'jsonb', nullable: true, name: 'iluma_data' })
  ilumaData: Record<string, any>;

  @Column({ name: 'last_check_at', type: 'timestamptz', nullable: true })
  lastCheckAt: Date;

    // --- Encrypted fields ---
  @Column({ type: 'bytea', nullable: true }) account_number_enc: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) account_number_iv: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) account_number_tag: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) account_number_edk: Buffer | null;
  @Column({ type: 'varchar', length: 32, default: 'AES-256-GCM' })
  account_number_alg: string;
  @Column({ type: 'jsonb', default: () => `'{}'` }) account_number_kmd: Record<
    string,
    any
  >;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
