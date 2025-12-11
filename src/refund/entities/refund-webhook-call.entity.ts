import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ulid } from 'ulid';
import { Refund } from './refund.entity';

@Entity('refund_webhook_calls')
export class RefundWebhookCall {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  @ManyToOne(() => Refund, { nullable: true })
  @JoinColumn({ name: 'refund_id' })
  refund: Refund | null;

  @Column({ name: 'refund_ref', type: 'varchar', nullable: false })
  refundRef: string;

  @Column({ name: 'source', type: 'varchar', nullable: false })
  source: string;

  @Column({ name: 'payload', type: 'jsonb', nullable: false })
  payload: Record<string, any>;

  @Column({ name: 'response', type: 'jsonb', nullable: true })
  response: Record<string, any> | null;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
