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
  })
  signatureStatus: string;

  @Column({
    type: 'text',
  })
  rawPayload: string;

  /** VIRTUAL COLUMN */
  // orderId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
