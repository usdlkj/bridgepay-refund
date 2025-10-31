import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ReportDataRow } from './report-data-row.entity';
export enum reportType {
  ILUMA = 'iluma',
  REFUND = 'refund',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'refund_start_date', type: 'date', nullable: true })
  refundStartDate: Date;

  @Column({ name: 'refund_end_date', type: 'date', nullable: true })
  refundEndDate: Date;

  @Column({ name: 'report_data', type: 'jsonb', nullable: true })
  reportData: Record<string, any>[]; // adjust based on actual shape

  @Column({
    name: 'report_type',
    type: 'text',
    default: 'refund',
  })
  reportType: 'refund' | 'iluma';

  @Column({
    name: 'report_status',
    type: 'text',
    default: 'process',
  })
  reportStatus: 'process' | 'completed';

  @OneToMany(() => ReportDataRow, (row) => row.report, { cascade: true })
  rows: ReportDataRow[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
