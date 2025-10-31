import { Entity, PrimaryColumn, BeforeInsert, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ulid } from "ulid";
export enum BankStatus {
  ENABLE = "enable",
  DISABLE = "disable"
}

export class SearchBankStatus {
  get(search){
    let data=[]
    data["enable"]=BankStatus.ENABLE
    data["disable"]=BankStatus.DISABLE
    
    return data[search]
  }
}

@Entity('refund_banks')
export class RefundBank {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id=ulid()
  }

  @Column({ name: 'bank_name' })
  bankName: string;

  @Column({ name: 'xendit_code', nullable: true })
  xenditCode: string;

  @Column({ type: 'jsonb', name: 'xendit_data', nullable: true })
  xenditData: Record<string, any>;

  @Column({ name: 'iluma_code', nullable: true })
  ilumaCode: string;

  @Column({ type: 'jsonb', name: 'iluma_data', nullable: true })
  ilumaData: Record<string, any>;

  @Column({ name: 'bank_status', default: 'disable' })
  bankStatus: 'disable' | 'enable';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}