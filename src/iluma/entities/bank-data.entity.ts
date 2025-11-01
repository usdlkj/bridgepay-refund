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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
