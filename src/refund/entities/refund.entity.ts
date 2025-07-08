import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { RefundDetail } from "./refund-detail.entity";

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'refund_id', nullable: true })
  refundId: string;

  @ManyToOne(() => RefundDetail)
  @JoinColumn({ name: 'refund_detail_id' })
  refundDetail: RefundDetail;

  @Column({
    name: 'refund_status',
    type: 'text',
    nullable: true,
  })
  refundStatus:
    | 'rbdApproval'
    | 'financeApproval'
    | 'pendingDisbursement'
    | 'reject'
    | 'success'
    | 'fail'
    | 'done'
    | 'onHold'
    | 'cancel'
    | 'retry';

  @Column({ name: 'refund_amount', type: 'numeric', nullable: true })
  refundAmount: number;

  @Column({ name: 'refund_amount_data', type: 'jsonb', nullable: true })
  refundAmountData: Record<string, any>;

  @Column({ name: 'refund_data', type: 'jsonb', nullable: true })
  refundData: Record<string, any>;

  @Column({ name: 'refund_reason', nullable: true })
  refundReason: string;

  @Column({ name: 'reject_reason', nullable: true })
  rejectReason: string;

  @Column({ name: 'reject_by', nullable: true })
  rejectBy: string;

  @Column({ name: 'approval_fin_by', nullable: true })
  approvalFinBy: string;

  @Column({ name: 'approval_rbd_by', nullable: true })
  approvalRbdBy: string;

  @Column({ name: 'approval_fin_at', type: 'timestamptz', nullable: true })
  approvalFinAt: Date;

  @Column({ name: 'approval_rbd_at', type: 'timestamptz', nullable: true })
  approvalRbdAt: Date;

  @Column({ name: 'reject_at', type: 'timestamptz', nullable: true })
  rejectAt: Date;

  @Column({ name: 'refund_bank_data', type: 'jsonb', nullable: true })
  refundBankData: Record<string, any>;

  @Column({ name: 'refund_date', type: 'timestamptz', nullable: true })
  refundDate: Date;

  @Column({ name: 'request_data', type: 'jsonb', nullable: true })
  requestData: Record<string, any>[]; // or array of structured DTOs

  @Column({ name: 'pg_callback', type: 'jsonb', nullable: true })
  pgCallback: Record<string, any>[]; // webhook/callback logs

  @Column({ name: 'retry_attempt', type: 'jsonb', nullable: true })
  retryAttempt: Record<string, any>[];

  @Column({ name: 'retry_date', type: 'timestamptz', nullable: true })
  retryDate: Date;

  @Column({ name: 'target_refund_date', type: 'timestamptz', nullable: true })
  targetRefundDate: Date;

  @Column({ name: 'refund_execute_data', type: 'jsonb', nullable: true })
  refundExecuteData: Record<string, any>;

  @Column({ name: 'notif_log', type: 'jsonb', nullable: true })
  notifLog: Record<string, any>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}