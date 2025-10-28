import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";


@Entity('ticketing-call-logs')
export class TicketingCallLog {
  @PrimaryGeneratedColumn()
  id: number;

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