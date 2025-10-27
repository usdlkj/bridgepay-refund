import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";


@Entity('refund_logs')
export class RefundLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name:'type',
    enum:['api',"general","info"],
  })
  type: string;

  @Column()
  location: string;

  @Column({type:"text"})
  detail: string;
  
  @Column({type:"text"})
  msg: string;

  @Column({type:"text"})
  notes: string;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}