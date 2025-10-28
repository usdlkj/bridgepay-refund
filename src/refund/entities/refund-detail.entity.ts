import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { RefundDetailTicket } from "./refund-detail-ticket.entity";

@Entity('refund_details')
export class RefundDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'refund_mw_id', nullable: true })
  refundMwId: number;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'refund_id', nullable: true })
  refundId: string;

  @Column({ name: 'refund_amount', type: 'numeric', nullable: true })
  refundAmount: number;

  @Column({ name: 'ticket_office', nullable: true })
  ticketOffice: string;

  @OneToMany(() => RefundDetailTicket, ticket => ticket.refundDetail, { cascade: true })
  ticketData: RefundDetailTicket[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}