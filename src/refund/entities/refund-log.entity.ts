import { Entity, PrimaryColumn, BeforeInsert, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { ulid } from "ulid";


@Entity('refund_logs')
export class RefundLog {
  @PrimaryColumn()
  id: string;

  @BeforeInsert()
  generateId() {
    this.id=ulid()
  }

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