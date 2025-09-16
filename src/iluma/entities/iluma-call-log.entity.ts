import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('iluma_call_logs')
export class IlumaCallLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column({
    type: 'text',
    enum: ['get', 'post', 'patch', 'put', 'delete'],
  })
  method: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}