import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ulid } from 'ulid';

@Entity('iluma_callbacks')
export class IlumaCallback {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  @Column({ name: 'callback_type', nullable: true })
  callbackType: string;

  @Column({ name: 'request_number', nullable: true })
  requestNumber: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, any>;

  @Column({ name: 'response_at', type: 'timestamptz', nullable: true })
  responseAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
