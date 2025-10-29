import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  ManyToOne,
  JoinColumn,

} from 'typeorm';
import { Report } from './report.entity';
import { ulid } from 'ulid';

@Entity('report_data_rows')
export class ReportDataRow {
  @PrimaryColumn()
    id: string;
  
  @BeforeInsert()
  generateId() {
    this.id=ulid()
  }

  @ManyToOne(() => Report, report => report.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @Column({ name: 'seq_no', type: 'int', nullable: true })
  seqNo: number;

  @Column({ name: 'refund_date', nullable: true })
  refundDate: string;

  @Column({ name: 'cancel_time', nullable: true })
  cancelTime: string;

  @Column({ name: 'refund_type', nullable: true })
  refundType: string;

  @Column({ name: 'refund_person', nullable: true })
  refundPerson: string;

  @Column({ name: 'refund_charge', type: 'numeric', nullable: true })
  refundCharge: number;

  @Column({ name: 'refund_charge_tax', type: 'numeric', nullable: true })
  refundChargeTax: number;

  @Column({ name: 'refund_amount', type: 'numeric', nullable: true })
  refundAmount: number;

  @Column({ name: 'refund_trande_no', nullable: true })
  refundTrandeNo: string;

  @Column({ name: 'plat_trade_no', nullable: true })
  platTradeNo: string;

  @Column({ name: 'refund_bank_code', nullable: true })
  refundBankCode: string;

  @Column({ name: 'refund_bank_name', nullable: true })
  refundBankName: string;

  @Column({ name: 'refund_account', nullable: true })
  refundAccount: string;

  @Column({ name: 'refund_account_name', nullable: true })
  refundAccountName: string;

  @Column({ name: 'actual_refund_amount', type: 'numeric', nullable: true })
  actualRefundAmount: number;

  @Column({ name: 'passenger_name', nullable: true })
  passengerName: string;

  @Column({ name: 'encrypted_id_number', nullable: true })
  encryptedIdNumber: string;

  @Column({ name: 'nationality', nullable: true })
  nationality: string;

  @Column({ name: 'order_number', nullable: true })
  orderNumber: string;

  @Column({ name: 'ticket_no', nullable: true })
  ticketNo: string;

  @Column({ name: 'ticketing_station', nullable: true })
  ticketingStation: string;

  @Column({ name: 'business_area', nullable: true })
  businessArea: string;

  @Column({ name: 'office_no', nullable: true })
  officeNo: string;

  @Column({ name: 'window_no', nullable: true })
  windowNo: string;

  @Column({ name: 'shift_no', nullable: true })
  shiftNo: string;

  @Column({ name: 'operator_name', nullable: true })
  operatorName: string;

  @Column({ name: 'ticketing_time', nullable: true })
  ticketingTime: string;

  @Column({ name: 'departure_time', nullable: true })
  departureTime: string;

  @Column({ name: 'train_no', nullable: true })
  trainNo: string;

  @Column({ name: 'origin', nullable: true })
  origin: string;

  @Column({ name: 'cars_number', nullable: true })
  carsNumber: string;

  @Column({ name: 'seat_number', nullable: true })
  seatNumber: string;

  @Column({ name: 'origin_code', nullable: true })
  originCode: string;

  @Column({ name: 'purchase_date', nullable: true })
  purchaseDate: string;

  @Column({ name: 'destination', nullable: true })
  destination: string;

  @Column({ name: 'destination_code', nullable: true })
  destinationCode: string;

  @Column({ name: 'arrival_time', nullable: true })
  arrivalTime: string;

  @Column({ name: 'seat_class', nullable: true })
  seatClass: string;

  @Column({ name: 'ticket_type', nullable: true })
  ticketType: string;

  @Column({ name: 'original_ticket_price', nullable: true })
  originalTicketPrice: string;
}