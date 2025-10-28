import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SIGNATURE_STATUS {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('api_log_debugs')
export class ApiLogDebug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  endpoint: string;

  @Column({
    type: 'text',
  })
  payload: string;

  @Column({
    type: 'text',
  })
  signature: string;

  @Column({
    type: 'enum',
    enum: SIGNATURE_STATUS,
    name:"signature_status"
  })
  signatureStatus: string;

  @Column({
    type: 'text',
    name:"raw_payload"
  })
  rawPayload: string;

  /** VIRTUAL COLUMN */
  // orderId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
