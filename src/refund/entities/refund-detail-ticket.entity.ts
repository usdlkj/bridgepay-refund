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

@Entity('refund_detail_tickets')
export class RefundDetailTicket {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = ulid();
  }

  @ManyToOne(() => RefundDetail, (detail) => detail.ticketData)
  @JoinColumn({ name: 'refund_detail_id' })
  refundDetail: RefundDetail;

  @Column({ name: 'arrival_station', nullable: true })
  arrivalStation: string;

  @Column({ name: 'cars_number', nullable: true })
  carsNumber: string;

  @Column({ name: 'departure_date', type: 'date', nullable: true })
  departureDate: string;

  @Column({ name: 'departure_station', nullable: true })
  departureStation: string;

  @Column({ name: 'identity_number', nullable: true })
  identityNumber: string; // Apply encryption in service layer

  @Column({ name: 'identity_type', nullable: true })
  identityType: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'order_number', nullable: true })
  orderNumber: string;

  @Column({ name: 'purchase_price', type: 'numeric', nullable: true })
  purchasePrice: number;

  @Column({ name: 'seat_number', nullable: true })
  seatNumber: string;

  @Column({ name: 'ticket_class', nullable: true })
  ticketClass: string;

  @Column({ name: 'ticket_number', nullable: true })
  ticketNumber: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
