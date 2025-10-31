import { Entity, PrimaryColumn, BeforeInsert, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import {ulid} from "ulid";


@Entity('ticketing-call-logs')
export class TicketingCallLog {
  @PrimaryColumn()
    id: string;
  
    @BeforeInsert()
    generateId() {
      this.id=ulid()
    }

  @Column({name:"refund_number"})
  refundNumber: string;

  @Column({type:"jsonb"})
  payload: Record<string, any>;;
  
  @Column({type:"jsonb"})
  response: Record<string, any>;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}