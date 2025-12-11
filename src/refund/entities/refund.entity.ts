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
import { RefundDetail } from './refund-detail.entity';
import { ulid } from 'ulid';

export enum RefundStatus {
  RBDAPPROVAL = 'rbdApproval',
  FINANCEAPPROVAL = 'financeApproval',
  PENDINGDISBURSEMENT = 'pendingDisbursement',
  REJECT = 'reject',
  SUCCESS = 'success',
  FAIL = 'fail',
  DONE = 'done',
  ONHOLD = 'onHold',
  CANCEL = 'cancel',
  RETRY = 'retry',
  PENDINGCHECKING = 'pendingChecking',
}

export class SearchRefundStatus {
  get(search) {
    const data = [];
    data['rbdapproval'] = RefundStatus.RBDAPPROVAL;
    data['financeapproval'] = RefundStatus.FINANCEAPPROVAL;
    data['pendingdisbursement'] = RefundStatus.PENDINGDISBURSEMENT;
    data['reject'] = RefundStatus.REJECT;
    data['success'] = RefundStatus.SUCCESS;
    data['fail'] = RefundStatus.FAIL;
    data['done'] = RefundStatus.DONE;
    data['onhold'] = RefundStatus.ONHOLD;
    data['cancel'] = RefundStatus.CANCEL;
    data['retry'] = RefundStatus.RETRY;
    data['pendingchecking'] = RefundStatus.PENDINGCHECKING;

    return data[search];
  }
}

@Entity('refunds')
export class Refund {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  @Column({ name: 'refund_ga_number', nullable: true, unique: true })
  refundId: string;

  @ManyToOne(() => RefundDetail)
  @JoinColumn({ name: 'refund_detail_id' })
  refundDetail: RefundDetail;

  @Column({
    name: 'refund_status',
    enum: RefundStatus,
    nullable: true,
    default: RefundStatus.RBDAPPROVAL,
  })
  refundStatus: RefundStatus;

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

  @Column({ name: 'retry_attempt', type: 'jsonb', nullable: true })
  retryAttempt: string[];

  @Column({ name: 'retry_date', type: 'timestamptz', nullable: true })
  retryDate: Date;

  @Column({ name: 'target_refund_date', type: 'timestamptz', nullable: true })
  targetRefundDate: Date;

  @Column({ name: 'refund_execute_data', type: 'jsonb', nullable: true })
  refundExecuteData: Record<any, any>;

  @Column({ name: 'notif_log', type: 'jsonb', nullable: true })
  notifLog: Record<string, any>[];

  @Column({ name: 'disbursement_id', nullable: true })
  disbursementId: string;

  @Column({ name: 'disbursement_response', type: 'jsonb', nullable: true })
  disbursementResponse: Record<string, any>;

  @Column({ name: 'bank_data_id', type: 'varchar', nullable: true })
  bankDataId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
