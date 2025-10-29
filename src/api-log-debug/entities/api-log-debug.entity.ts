import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { ulid } from 'ulid';


export enum SIGNATURE_STATUS {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('api_log_debugs')
export class ApiLogDebug {

  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id=ulid()
  }

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
